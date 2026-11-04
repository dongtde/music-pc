export const WORLD_SCENES=[
  {id:'rain',name:'雨夜城市',subtitle:'RAIN / AFTER HOURS',description:'玻璃穹顶、雨幕与城市夜景',asset:null,background:'#081421',fog:'#142434',ambient:.85,sun:1.25,practical:.48,environment:.25,exposure:1.05,lightIntensity:1,palette:{primary:'#53c9f0',secondary:'#9279ee'},materials:{walnut:'#33434c','woven-fabric':'#56717c','champagne-metal':'#8ca4b5'}},
  {id:'studio',name:'黑胶工作室',subtitle:'VINYL / WARM SESSIONS',description:'木地板、吸音墙与开盘机',asset:'vinyl-studio.glb',background:'#29211d',fog:'#3b3028',ambient:1.2,sun:1.65,practical:.72,environment:.36,exposure:1.12,lightIntensity:.9,palette:{primary:'#ffbf70',secondary:'#e88572'},materials:{walnut:'#715139','woven-fabric':'#9b8669','champagne-metal':'#bea273'}},
  {id:'stage',name:'未来演出厅',subtitle:'LIVE / AFTER DARK',description:'多重舞台框架、光幕与现场灯阵',asset:'future-live.glb',background:'#060b16',fog:'#111429',ambient:.42,sun:.65,practical:.16,environment:.21,exposure:1,lightIntensity:1.12,palette:{primary:'#41e5f4',secondary:'#d965eb'},materials:{walnut:'#242a38','woven-fabric':'#41475f','champagne-metal':'#839abe'}},
]
export function getWorldScene(id){return WORLD_SCENES.find(scene=>scene.id===id)||WORLD_SCENES[0]}
