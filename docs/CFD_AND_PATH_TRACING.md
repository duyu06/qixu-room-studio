# 栖序 V9 — CFD 与 WebGPU 路线（2026-10-22）

## 当前交付边界
- 主站：Three.js WebGL 实时编辑；门口到窗户的**二维压力势流近似**。
- 物理光学预览：`site/photoreal.html` 在 WebGPU 能用时调用 `three-gpu-pathtracer@0.0.27`，从本地已保存的户型模型生成具有多次反射的材质预览；动态依赖导入失败将给出降级信息。该模式与实时编辑分离。
- CFD 输入：浏览器下载 `qixu-cfd-input.json`，提供**未校准**房间宽深高、墙线、家具、进风门、排风窗及假设边界条件。**它不是 OpenFOAM 案例，也没有运行 Navier–Stokes 求解。**
- 日照：SunCalc **v2.1.1** `getPosition()` 返回 **角度（度）**、从真北顺时针计的方位，前端已适配。

## 后端 OpenFOAM 实施顺序
1. 导入 CAD/测量尺寸校准 3D 外墙、门洞和窗洞高度；墙体与顶棚必须闭合，且开口需落在实际几何边界。
2. 将户型墙线外推实体壁面，生成 watertight STL / surface meshes；对外立面进出口生成独立 patch。
3. 使用 `blockMesh` 建背景网格、`snappyHexMesh` 贴体网格，`checkMesh` 检验质量。不得对几何未闭合或 patch 未标记的文件直接运行 CFD。
4. 先跑不含热浮力的 steady incompressible `simpleFoam` 以验证通量平衡，设置进风速度、排风压力与壁面 no-slip；再按需要引入湍流模型、`pimpleFoam` 瞬态和热浮力。
5. 校验质量守恒（各开口质量通量之和接近零）、网格无关性及网格收敛；与现场风速/差压数据对照，才能给出定量通风判断。
6. 后端返回 vtk/vtu 或速度场栅格供 Three.js 显示流线；异步计算任务必须包含 job_id/status/mesh_quality/solver_residuals，并留存版本信息。

## 静态托管限制
现有 Render Static Site 不能直接运行 OpenFOAM。需要另外配置计算节点（Linux / Docker、按需 CPU 资源），并为 CFD 请求增加权限控制、资源限额和任务队列。**不应在未获授权前创建计费服务。**

## 输入数据必须补齐
- 室内真尺寸与层高（单位米），真实门窗坐标、高宽、开启状态。
- 户型真北方向；室外风压或风速和风向；室内外温差、风机/空调工况。
- 家具实际位置与占地、外部建筑遮挡（若分析照度）。
- 无实际测量时，输出只能标为演示/未校准估算。

参考：
- https://www.openfoam.com/documentation/user-guide
- https://github.com/gkjohnson/three-gpu-pathtracer
- https://github.com/mourner/suncalc
