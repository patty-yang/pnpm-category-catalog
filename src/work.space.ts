import type { IConfig, IWorkSpace, IWorkSpaceConfig, IWorkSpaceContext } from '@/types.ts'
import { readFile } from 'node:fs/promises'
import { multiselect, text } from '@clack/prompts'
import { findUp } from 'find-up'
import { parse, stringify } from 'yaml'

export const getWorkSpaceYaml = async (config: IConfig): Promise<IWorkSpace> => {
    const workSpaceYamlPath = await findUp('pnpm-workspace.yaml', {
        cwd: config.cwd,
    })

    if (!workSpaceYamlPath) {
        throw new Error('当前暂未使用 pnpm-workspace.yaml 相关功能，请检测您当前的项目后在使用此 CLI 工具')
    }

    return {
        workSpaceYamlPath,
        workspace: parse(await readFile(workSpaceYamlPath, 'utf-8')),
    }
}

export const getNewWorkSpaceYaml = async (config: IWorkSpaceConfig): Promise<IWorkSpaceContext> => {
    const context = config.workspace
    if (!context.catalog) {
        throw new Error('暂无 catalog')
    }

    const catalog = context.catalog

    const choice = await multiselect({
        message: '选择要切换的包',
        options: Object.keys(catalog).map(key => ({
            value: key,
            label: key,
        })),
    }) as string[]

    const catalogsName = await text({
        message: '请输入自定义分类名称',
        placeholder: '',
        defaultValue: '',
    }) as string

    // 将选择的结果与 catalog 匹配，得到 key: value 版本号
    const dependencies: Record<string, string> = {}
    if (choice && typeof choice === 'object') {
        choice.forEach((key: string) => {
            dependencies[key] = catalog[key]!
        })
    }

    console.log('选中的包对象:', dependencies)

    // 从 context.catalog 中删除选中的 key
    if (choice && typeof choice === 'object') {
        choice.forEach((key: string) => {
            delete context.catalog![key]
        })
    }

    // 检查 catalogsName 是否有值
    if (!catalogsName) {
        throw new Error('未输入有效的分类名称，操作已取消')
    }

    // 确保 context.catalogs 存在
    if (!context.catalogs) {
        context.catalogs = {}
    }

    // 检查节点是否存在，存在则合并，不存在则创建
    if (context.catalogs[catalogsName]) {
        // 节点已存在，合并 packages
        context.catalogs[catalogsName] = {
            ...context.catalogs[catalogsName],
            ...dependencies,
        }
        // console.log(`已将选中的包合并到 catalogs.${catalogsName} 节点中`)
    }
    else {
        // 节点不存在，直接赋值
        context.catalogs[catalogsName] = dependencies
        // console.log(`已将选中的包添加到 catalogs.${catalogsName} 节点中`)
    }

    // 将更新后的 context 写回到文件
    return {
        path: config.workSpaceYamlPath,
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
