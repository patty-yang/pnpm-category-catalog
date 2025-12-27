import { readFile } from 'node:fs/promises'
import { multiselect, text } from '@clack/prompts'
import { findUp } from 'find-up'
import { parse, stringify } from 'yaml'

export const getNewWorkSpaceYaml = async (config: any) => {
    const pnpmWorkSpacePath = await findUp('pnpm-workspace.yaml', {
        cwd: config.cwd,
    })

    if (!pnpmWorkSpacePath) {
        return 'no has pnpm-workspace.yaml'
    }

    const context = parse(await readFile(pnpmWorkSpacePath, 'utf-8'))

    if (!context.catalog) {
        return '暂无 catalog'
    }

    const catalog = context.catalog

    const choice = await multiselect({
        message: '选择要切换的包',
        options: Object.keys(catalog).map(key => ({
            value: key,
            label: key,
        })),

    })

    const catalogsName = await text({
        message: '请输入自定义分类名称',
        placeholder: '',
        defaultValue: '',
    })

    // 将选择的结果与 catalog 匹配，得到 key: value 版本号
    const dependencies: Record<string, string> = {}
    if (choice && typeof choice === 'object') {
        choice.forEach((key: string) => {
            dependencies[key] = catalog[key]
        })
    }

    console.log('选中的包对象:', dependencies)

    // 从 context.catalog 中删除选中的 key
    if (choice && typeof choice === 'object') {
        choice.forEach((key: string) => {
            delete context.catalog[key]
        })
    }

    // 检查 catalogsName 是否有值
    if (catalogsName && typeof catalogsName === 'string' && catalogsName.trim()) {
        const categoryName = catalogsName.trim()

        // 确保 context.catalogs 存在
        if (!context.catalogs) {
            context.catalogs = {}
        }

        // 检查节点是否存在，存在则合并，不存在则创建
        if (context.catalogs[categoryName]) {
            // 节点已存在，合并 packages
            context.catalogs[categoryName] = {
                ...context.catalogs[categoryName],
                ...dependencies,
            }
            console.log(`已将选中的包合并到 catalogs.${categoryName} 节点中`)
        }
        else {
            // 节点不存在，直接赋值
            context.catalogs[categoryName] = dependencies
            console.log(`已将选中的包添加到 catalogs.${categoryName} 节点中`)
        }

        // 将更新后的 context 写回到文件
        return {
            path: pnpmWorkSpacePath,
            // 最终要替换 pnpm-workspace.yaml 内容
            context: stringify(context, {
                indent: 2,
                lineWidth: 0,
                minContentWidth: 0,
            }),
            // catalogs 新增节点内容
            catalogs: {
                choice,
                name: catalogsName,
                dependencies,
            },

        }
    }
    else {
        console.log('未输入有效的分类名称，操作已取消')
    }
}
