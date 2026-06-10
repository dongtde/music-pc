import http from '../http'

export function getPersonalizedPlaylists(params = {}) {
  return http.get('/personalized', {
    params
  })
}

export function getBanners(params = {}) {
  return http.get('/banner', {
    params
  })
}

export function getPersonalizedMvs(params = {}) {
  return http.get('/personalized/mv', {
    params
  })
}

export function subscribeMv(params = {}) {
  return http.get('/mv/sub', {
    params
  })
}

export function getSubscribedMvs(params = {}) {
  return http.get('/mv/sublist', {
    params
  })
}

export function getMvComments(params = {}) {
  return http.get('/comment/mv', {
    params
  })
}

export function likeResource(params = {}) {
  return http.get('/resource/like', {
    params
  })
}

export function getSimilarMvs(params = {}) {
  return http.get('/simi/mv', {
    params
  })
}

export function getAllMvs(params = {}) {
  return http.get('/mv/all', {
    params
  })
}

export function getFirstMvs(params = {}) {
  return http.get('/mv/first', {
    params
  })
}

export function getExclusiveMvs(params = {}) {
  return http.get('/mv/exclusive/rcmd', {
    params
  })
}

export function getTopMvs(params = {}) {
  return http.get('/top/mv', {
    params
  })
}

export function getMvDetail(params = {}) {
  return http.get('/mv/detail', {
    params
  })
}

export function getMvDetailInfo(params = {}) {
  return http.get('/mv/detail/info', {
    params
  })
}

export function getMvUrl(params = {}) {
  return http.get('/mv/url', {
    params
  })
}

export function getFollowArtistNewMvs(params = {}) {
  return http.get('/artist/new/mv', {
    params
  })
}

export function getUgcMv(params = {}) {
  return http.get('/ugc/mv/get', {
    params
  })
}

export function getPersonalizedNewSongs(params = {}) {
  return http.get('/personalized/newsong', {
    params
  })
}

export function getPersonalFm(params = {}) {
  return http.get('/personal_fm', {
    params
  })
}

export function getPersonalFmByMode(params = {}) {
  return http.get('/personal/fm/mode', {
    params
  })
}

export function sendFmTrash(params = {}) {
  return http.get('/fm_trash', {
    params
  })
}

export function getPersonalizedDjPrograms(params = {}) {
  return http.get('/personalized/djprogram', {
    params
  })
}

export function getDjBanner(params = {}) {
  return http.get('/dj/banner', {
    params
  })
}

export function getDjPersonalizeRecommend(params = {}) {
  return http.get('/dj/personalize/recommend', {
    params
  })
}

export function getDjHot(params = {}) {
  return http.get('/dj/hot', {
    params
  })
}

export function getDjProgramToplist(params = {}) {
  return http.get('/dj/program/toplist', {
    params
  })
}

export function getDjProgramHoursToplist(params = {}) {
  return http.get('/dj/program/toplist/hours', {
    params
  })
}

export function getDjToplist(params = {}) {
  return http.get('/dj/toplist', {
    params
  })
}

export function getDjToplistPay(params = {}) {
  return http.get('/dj/toplist/pay', {
    params
  })
}

export function getDjToplistHours(params = {}) {
  return http.get('/dj/toplist/hours', {
    params
  })
}

export function getDjToplistNewcomer(params = {}) {
  return http.get('/dj/toplist/newcomer', {
    params
  })
}

export function getDjToplistPopular(params = {}) {
  return http.get('/dj/toplist/popular', {
    params
  })
}

export function getDjRadioHot(params = {}) {
  return http.get('/dj/radio/hot', {
    params
  })
}

export function getDjRecommend(params = {}) {
  return http.get('/dj/recommend', {
    params
  })
}

export function getDjCatelist(params = {}) {
  return http.get('/dj/catelist', {
    params
  })
}

export function getDjRecommendType(params = {}) {
  return http.get('/dj/recommend/type', {
    params
  })
}

export function updateDjSubscribe(params = {}) {
  return http.get('/dj/sub', {
    params
  })
}

export function getDjSublist(params = {}) {
  return http.get('/dj/sublist', {
    params
  })
}

export function getDjPaygift(params = {}) {
  return http.get('/dj/paygift', {
    params
  })
}

export function getDjCategoryExcludehot(params = {}) {
  return http.get('/dj/category/excludehot', {
    params
  })
}

export function getDjCategoryRecommend(params = {}) {
  return http.get('/dj/category/recommend', {
    params
  })
}

export function getDjTodayPreferred(params = {}) {
  return http.get('/dj/today/perfered', {
    params
  })
}

export function getDjDetail(params = {}) {
  return http.get('/dj/detail', {
    params
  })
}

export function getDjPrograms(params = {}) {
  return http.get('/dj/program', {
    params
  })
}

export function getDjProgramDetail(params = {}) {
  return http.get('/dj/program/detail', {
    params
  })
}

export function getDjComments(params = {}) {
  return http.get('/comment/dj', {
    params
  })
}

export function getRecentDj(params = {}) {
  return http.get('/record/recent/dj', {
    params
  })
}

export function searchVoiceLists(params = {}) {
  return http.get('/voicelist/search', {
    params
  })
}

export function searchVoiceListPrograms(params = {}) {
  return http.get('/voicelist/list/search', {
    params
  })
}

export function getVoiceListDetail(params = {}) {
  return http.get('/voicelist/detail', {
    params
  })
}

export function getVoiceListPrograms(params = {}) {
  return http.get('/voicelist/list', {
    params
  })
}

export function getVoiceDetail(params = {}) {
  return http.get('/voice/detail', {
    params
  })
}

export function getVoiceLyric(params = {}) {
  return http.get('/voice/lyric', {
    params
  })
}

export function getMyCreatedVoiceList(params = {}) {
  return http.get('/voicelist/my/created', {
    params
  })
}

export function getBroadcastCategoryRegion(params = {}) {
  return http.get('/broadcast/category/region/get', {
    params
  })
}

export function getBroadcastCollectList(params = {}) {
  return http.get('/broadcast/channel/collect/list', {
    params
  })
}

export function getBroadcastCurrentInfo(params = {}) {
  return http.get('/broadcast/channel/currentinfo', {
    params
  })
}

export function getBroadcastChannelList(params = {}) {
  return http.get('/broadcast/channel/list', {
    params
  })
}

export function updateBroadcastSubscribe(params = {}) {
  return http.get('/broadcast/sub', {
    params
  })
}

export function getDifmStyleChannels(params = {}) {
  return http.get('/dj/difm/all/style/channel', {
    params
  })
}

export function getDifmSubscribedChannels(params = {}) {
  return http.get('/dj/difm/subscribe/channels/get', {
    params
  })
}

export function subscribeDifmChannel(params = {}) {
  return http.get('/dj/difm/channel/subscribe', {
    params
  })
}

export function unsubscribeDifmChannel(params = {}) {
  return http.get('/dj/difm/channel/unsubscribe', {
    params
  })
}

export function getDifmPlayingTracks(params = {}) {
  return http.get('/dj/difm/playing/tracks/list', {
    params
  })
}

export function getSatiTimeSceneResources(params = {}) {
  return http.get('/sati/timescene/resources/get', {
    params
  })
}

export function getSatiTags(params = {}) {
  return http.get('/sati/tag/list', {
    params
  })
}

export function getSatiResources(params = {}) {
  return http.get('/sati/resource/list', {
    params
  })
}

export function getSatiMoreResources(params = {}) {
  return http.get('/sati/resource/list/more', {
    params
  })
}

export function getSatiSubscribedResources(params = {}) {
  return http.get('/sati/resource/sub/list', {
    params
  })
}

export function updateSatiSubscribe(params = {}) {
  return http.get('/sati/resource/sub', {
    params
  })
}

export function getSportRadio(params = {}) {
  return http.get('/radio/sport/get', {
    params
  })
}

export function checkSongLike(params = {}) {
  return http.get('/song/like/check', {
    params
  })
}

export function updateSongLike(params = {}) {
  return http.get('/song/like', {
    params
  })
}

export function getPlaylistDetail(params = {}) {
  return http.get('/playlist/detail', {
    params
  })
}

export function getPlaylistTracks(params = {}) {
  return http.get('/playlist/track/all', {
    params
  })
}

export function getPlaylistHotCategories(params = {}) {
  return http.get('/playlist/hot', {
    params
  })
}

export function getPlaylistCategories(params = {}) {
  return http.get('/playlist/catlist', {
    params
  })
}

export function getTopPlaylists(params = {}) {
  return http.get('/top/playlist', {
    params
  })
}

export function getHighQualityPlaylists(params = {}) {
  return http.get('/top/playlist/highquality', {
    params
  })
}

export function getToplist(params = {}) {
  return http.get('/toplist', {
    params
  })
}

export function getArtistList(params = {}) {
  return http.get('/artist/list', {
    params
  })
}

export function getArtistToplist(params = {}) {
  return http.get('/toplist/artist', {
    params
  })
}

export function getArtistDetail(params = {}) {
  return http.get('/artist/detail', {
    params
  })
}

export function getArtistHotSongs(params = {}) {
  return http.get('/artists', {
    params
  })
}

export function getArtistTopSongs(params = {}) {
  return http.get('/artist/top/song', {
    params
  })
}

export function getArtistSongs(params = {}) {
  return http.get('/artist/songs', {
    params
  })
}

export function getArtistAlbums(params = {}) {
  return http.get('/artist/album', {
    params
  })
}

export function getArtistMvs(params = {}) {
  return http.get('/artist/mv', {
    params
  })
}

export function getArtistVideos(params = {}) {
  return http.get('/artist/video', {
    params
  })
}

export function getArtistDesc(params = {}) {
  return http.get('/artist/desc', {
    params
  })
}

export function getArtistDynamic(params = {}) {
  return http.get('/artist/detail/dynamic', {
    params
  })
}

export function getAlbumNewest(params = {}) {
  return http.get('/album/newest', {
    params
  })
}

export function getNewAlbums(params = {}) {
  return http.get('/album/new', {
    params
  })
}

export function getTopAlbums(params = {}) {
  return http.get('/top/album', {
    params
  })
}

export function getAlbumDetail(params = {}) {
  return http.get('/album', {
    params
  })
}

export function getAlbumDynamic(params = {}) {
  return http.get('/album/detail/dynamic', {
    params
  })
}

export function getAlbumComments(params = {}) {
  return http.get('/comment/album', {
    params
  })
}

export function getPlaylistComments(params = {}) {
  return http.get('/comment/playlist', {
    params
  })
}

export function getCommentInfoList(params = {}) {
  return http.get('/comment/info/list', {
    params
  })
}

export function getLoginStatus(params = {}) {
  return http.get('/login/status', {
    params
  })
}

export function loginByCellphone(params = {}) {
  return http.get('/login/cellphone', {
    params
  })
}

export function loginByEmail(params = {}) {
  return http.get('/login', {
    params
  })
}

export function registerAnonymous(params = {}) {
  return http.get('/register/anonimous', {
    params
  })
}

export function refreshLogin(params = {}) {
  return http.get('/login/refresh', {
    params
  })
}

export function sendCaptcha(params = {}) {
  return http.get('/captcha/sent', {
    params
  })
}

export function verifyCaptcha(params = {}) {
  return http.get('/captcha/verify', {
    params
  })
}

export function getLoginQrKey(params = {}) {
  return http.get('/login/qr/key', {
    params
  })
}

export function getLoginQrCreate(params = {}) {
  return http.get('/login/qr/create', {
    params
  })
}

export function getLoginQrCheck(params = {}) {
  return http.get('/login/qr/check', {
    acceptCodes: [800, 801, 802, 803],
    params
  })
}

export function getUserAccount(params = {}) {
  return http.get('/user/account', {
    params
  })
}

export function logout(params = {}) {
  return http.get('/logout', {
    params
  })
}

export function getSongComments(params = {}) {
  return http.get('/comment/music', {
    params
  })
}

export function getSongRedCount(params = {}) {
  return http.get('/song/red/count', {
    params
  })
}

export function getSongUrl(params = {}) {
  return http.get('/song/url/v1', {
    params
  })
}

export function getLyric(params = {}) {
  return http.get('/lyric', {
    params
  })
}

export function getSearchDefault(params = {}) {
  return http.get('/search/default', {
    params
  })
}

export function getSearchHotDetail(params = {}) {
  return http.get('/search/hot/detail', {
    params
  })
}

export function getSearchSuggestPc(params = {}) {
  return http.get('/search/suggest/pc', {
    params
  })
}

export function getSearchMultiMatch(params = {}) {
  return http.get('/search/multimatch', {
    params
  })
}

export function getCloudSearch(params = {}) {
  return http.get('/cloudsearch', {
    params
  })
}
