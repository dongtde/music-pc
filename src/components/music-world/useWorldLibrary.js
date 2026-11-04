import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { getHomeDiscoverData, getChartsDiscoveryData, getArtistsDiscoveryData, getSearchResultData, getPlaylistTracksData, getArtistSongsData } from '../../services/netease'
import { useLibraryStore } from '../../stores/library'
import { recommendedSingles } from '../../data/music'

export function useWorldLibrary() {
  const library = useLibraryStore(), home = shallowRef({}), charts = shallowRef([]), artists = shallowRef([])
  const section = ref('recommend'), title = ref('今日发现'), items = shallowRef([]), busy = ref(false), error = ref(''), detail = ref(false)
  const search = ref(''), searchType = ref(1)
  let request = 0, disposed = false, homePromise = null
  const favorites = computed(() => library.state.likedTracks.map(item => ({ ...item, kind: 'song' })))
  const recent = computed(() => library.state.recentTracks.map(item => ({ ...item, kind: 'song' })))
  const recommendations = computed(() => (home.value.recommendedSingles?.length ? home.value.recommendedSingles : recommendedSingles).map(item => ({ ...item, kind: 'song' })))
  const displayItems = computed(() => detail.value ? items.value : section.value === 'liked' ? favorites.value : section.value === 'recent' ? recent.value : items.value)
  const exhibits = computed(() => ({ archive: (favorites.value.length ? favorites.value : recent.value).slice(0,4), discover: recommendations.value.slice(0,4) }))
  async function loadHome(force = false) {
    if (!homePromise || force) homePromise = getHomeDiscoverData({ timeoutMs: 4000 }).then(data => { if (!disposed) home.value = data; return data }).catch(() => ({}))
    return homePromise
  }
  async function loadSection(id) {
    const token = ++request
    section.value = id; detail.value = false; error.value = ''; busy.value = true; items.value = []; more.value = false
    title.value = ({ recommend:'今日发现',playlists:'精选歌单',charts:'音乐排行榜',artists:'艺术家',liked:'我喜欢的音乐',recent:'最近播放',radio:'声音沙龙',video:'音乐影像',search:'检索音乐' })[id] || '音乐馆'
    try {
      let result = []
      if (id === 'liked' || id === 'recent' || id === 'search') return
      if (['recommend','playlists','radio','video'].includes(id)) {
        await loadHome()
        if (id === 'recommend') result = recommendations.value
        if (id === 'playlists') result = (home.value.recommendPlaylists || []).map(item => ({ ...item,kind:'playlist' }))
        if (id === 'radio') result = (home.value.recommendedRadios || []).map(item => ({ ...item,kind:'radio' }))
        if (id === 'video') result = (home.value.recommendedMvs || []).map(item => ({ ...item,kind:'video' }))
      } else if (id === 'charts') {
        if (!charts.value.length) { const data=await getChartsDiscoveryData(); if (!disposed) charts.value=[...data.officialCharts,...data.globalCharts] }
        result = charts.value.map(item=>({...item,kind:'playlist'}))
      } else if (id === 'artists') {
        if (!artists.value.length) { const data=await getArtistsDiscoveryData({limit:24}); if(!disposed) artists.value=data.artists }
        result = artists.value.map(item=>({...item,kind:'artist'}))
      }
      if (token === request && !disposed) { items.value=result; if(!result.length) error.value='暂时没有获取到内容，请稍后重试。' }
    } catch { if(token===request&&!disposed) error.value='内容加载失败，请检查连接后重试。' }
    finally { if(token===request&&!disposed) busy.value=false }
  }
  async function submitSearch(append = false) {
    const keyword = search.value.trim(); if (!keyword) return
    const token = ++request, offset = append ? items.value.length : 0
    section.value='search';detail.value=false;busy.value=true;error.value='';title.value=`搜索 · ${keyword}`
    if(!append)items.value=[]
    try {
      const data=await getSearchResultData({keyword,type:searchType.value,limit:30,offset})
      if(token!==request||disposed)return
      items.value=[...(append?items.value:[]),...data.items.map(item=>({...item,kind:({1:'song',1000:'playlist',100:'artist'})[searchType.value]}))]
      more.value=data.hasMore
    } catch { if(token===request&&!disposed)error.value='搜索失败，请稍后重试。' }
    finally { if(token===request&&!disposed)busy.value=false }
  }
  const more=ref(false)
  async function openCollection(item) {
    lastCollection = item
    const token=++request;busy.value=true;error.value='';detail.value=true;title.value=item.name||item.title;items.value=[]
    try {
      const local = item.kind==='playlist' ? library.getPlaylist(item.id) : null
      const result = local?.tracks?.length ? local : item.kind==='artist'
        ? await getArtistSongsData({id:item.id,limit:100})
        : await getPlaylistTracksData({id:item.id,listid:item.listid||'',limit:100})
      if(token===request&&!disposed)items.value=(result.tracks||[]).map(track=>({...track,kind:'song'}))
    }catch{if(token===request&&!disposed)error.value='曲目加载失败，请重试。'}
    finally{if(token===request&&!disposed)busy.value=false}
  }
  function retry() {
    if (detail.value && lastCollection) return openCollection(lastCollection)
    if (section.value === 'search') return submitSearch()
    homePromise = null
    return loadSection(section.value)
  }
  let lastCollection = null
  onBeforeUnmount(()=>{disposed=true;request++})
  return { library, section,title,items:displayItems,busy,error,detail,search,searchType,more,exhibits,recommendations,loadHome,loadSection,submitSearch,openCollection,retry }
}
