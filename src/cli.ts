import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import cac from 'cac'
import { glob } from 'glob'
import { resolveConfig } from '@/config.ts'
import { stringifyYamlWithTopLevelBlankLine } from '@/utils.ts'
import { getNewWorkSpaceYaml } from '@/work.space.ts'
import { name, version } from '../package.json'

const cli = cac(name)

cli.command('')
    .action(async () => {
        const config = resolveConfig()
        // console.log(config.cwd)
        const packagePathMap = await glob(['package.json', '*/**/package.json'], {
            cwd: config.cwd,
            ignore: ['**/node_modules/**'],
        })
        // console.log(packagePathMap)

        const packageDependencies = packagePathMap.map(p => JSON.parse(readFileSync(resolve(config.cwd, p), 'utf-8')))
        // console.log(packageDependencies)
        const workspace = await getNewWorkSpaceYaml(config)
        // console.log(workspace)

        // 更新 package.json 中的依赖版本
        if (workspace && typeof workspace === 'object' && 'catalogs' in workspace && workspace.catalogs && workspace.catalogs.dependencies) {
            updatePackageDependencies(packagePathMap, workspace.catalogs, config.cwd)

            writeFileSync(workspace.path, stringifyYamlWithTopLevelBlankLine(workspace.context), 'utf-8')
        }
    })

function updatePackageDependencies(packagePathMap: any[], catalogs: any, cwd: string) {
    const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

    packagePathMap.forEach((path: any, index: number) => {
        // const packagePaths = glob.sync(['package.json', '*/**/package.json'], {
        //     cwd,
        //     ignore: ['**/node_modules/**'],
        // })
        // const packagePath = packagePaths[index]

        const filePath = resolve(cwd, path)
        const context = JSON.parse(readFileSync(filePath, 'utf-8'))

        let updated = false

        dependencyTypes.forEach((depType) => {
            if (context[depType]) {
                Object.keys(context[depType]).forEach((depName) => {
                    // 检查这个依赖是否在选中的 dependencies 中
                    if (catalogs.dependencies[depName]) {
                        // 更新版本为 catalog:{$catalogs.name}
                        context[depType][depName] = `catalog:${catalogs.name}`
                        updated = true
                        // console.log(`更新 ${filePath} 中的 ${depName} 为 catalog:${catalogs.name}`)
                    }
                })
            }
        })

        // 如果有更新，写回到文件
        if (updated) {
            // console.log(context)
            writeFileSync(filePath, `${JSON.stringify(context, null, 2)}\n`, 'utf-8')
        //     const fullPath = resolve(cwd, packagePath)
        //     writeFileSync(fullPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
        //     console.log(`已更新 ${fullPath}`)
        }
    })
}

cli.help()
cli.version(version)
cli.parse()
