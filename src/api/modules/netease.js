import http from '../http'

function getNetease(path, params = {}, config = {}) {
  return http.get(path, {
    ...config,
    params
  })
}

export function getPersonalizedPlaylists(params = {}) {
  return getNetease('/personalized', params)
}

export function getBanners(params = {}) {
  return getNetease('/banner', params)
}

export function getPersonalizedMvs(params = {}) {
  return getNetease('/personalized/mv', params)
}

export function subscribeMv(params = {}) {
  return getNetease('/mv/sub', params)
}

export function getSubscribedMvs(params = {}) {
  return getNetease('/mv/sublist', params)
}

export function getMvComments(params = {}) {
  return getNetease('/comment/mv', params)
}

export function likeResource(params = {}) {
  return getNetease('/resource/like', params)
}

export function getSimilarMvs(params = {}) {
  return getNetease('/simi/mv', params)
}

export function getAllMvs(params = {}) {
  return getNetease('/mv/all', params)
}

export function getFirstMvs(params = {}) {
  return getNetease('/mv/first', params)
}

export function getExclusiveMvs(params = {}) {
  return getNetease('/mv/exclusive/rcmd', params)
}

export function getTopMvs(params = {}) {
  return getNetease('/top/mv', params)
}

export function getMvDetail(params = {}) {
  return getNetease('/mv/detail', params)
}

export function getMvDetailInfo(params = {}) {
  return getNetease('/mv/detail/info', params)
}

export function getMvUrl(params = {}) {
  return getNetease('/mv/url', params)
}

export function getFollowArtistNewMvs(params = {}) {
  return getNetease('/artist/new/mv', params)
}

export function getUgcMv(params = {}) {
  return getNetease('/ugc/mv/get', params)
}

export function getPersonalizedNewSongs(params = {}) {
  return getNetease('/personalized/newsong', params)
}

export function getPersonalFm(params = {}) {
  return getNetease('/personal_fm', params)
}

export function getPersonalFmByMode(params = {}) {
  return getNetease('/personal/fm/mode', params)
}

export function sendFmTrash(params = {}) {
  return getNetease('/fm_trash', params)
}

export function getPersonalizedDjPrograms(params = {}) {
  return getNetease('/personalized/djprogram', params)
}

export function getDjBanner(params = {}) {
  return getNetease('/dj/banner', params)
}

export function getDjPersonalizeRecommend(params = {}) {
  return getNetease('/dj/personalize/recommend', params)
}

export function getDjHot(params = {}) {
  return getNetease('/dj/hot', params)
}

export function getDjProgramToplist(params = {}) {
  return getNetease('/dj/program/toplist', params)
}

export function getDjProgramHoursToplist(params = {}) {
  return getNetease('/dj/program/toplist/hours', params)
}

export function getDjToplist(params = {}) {
  return getNetease('/dj/toplist', params)
}

export function getDjToplistPay(params = {}) {
  return getNetease('/dj/toplist/pay', params)
}

export function getDjToplistHours(params = {}) {
  return getNetease('/dj/toplist/hours', params)
}

export function getDjToplistNewcomer(params = {}) {
  return getNetease('/dj/toplist/newcomer', params)
}

export function getDjToplistPopular(params = {}) {
  return getNetease('/dj/toplist/popular', params)
}

export function getDjRadioHot(params = {}) {
  return getNetease('/dj/radio/hot', params)
}

export function getDjRecommend(params = {}) {
  return getNetease('/dj/recommend', params)
}

export function getDjCatelist(params = {}) {
  return getNetease('/dj/catelist', params)
}

export function getDjRecommendType(params = {}) {
  return getNetease('/dj/recommend/type', params)
}

export function updateDjSubscribe(params = {}) {
  return getNetease('/dj/sub', params)
}

export function getDjSublist(params = {}) {
  return getNetease('/dj/sublist', params)
}

export function getDjPaygift(params = {}) {
  return getNetease('/dj/paygift', params)
}

export function getDjCategoryExcludehot(params = {}) {
  return getNetease('/dj/category/excludehot', params)
}

export function getDjCategoryRecommend(params = {}) {
  return getNetease('/dj/category/recommend', params)
}

export function getDjTodayPreferred(params = {}) {
  return getNetease('/dj/today/perfered', params)
}

export function getDjDetail(params = {}) {
  return getNetease('/dj/detail', params)
}

export function getDjPrograms(params = {}) {
  return getNetease('/dj/program', params)
}

export function getDjProgramDetail(params = {}) {
  return getNetease('/dj/program/detail', params)
}

export function getDjComments(params = {}) {
  return getNetease('/comment/dj', params)
}

export function getRecentDj(params = {}) {
  return getNetease('/record/recent/dj', params)
}

export function searchVoiceLists(params = {}) {
  return getNetease('/voicelist/search', params)
}

export function searchVoiceListPrograms(params = {}) {
  return getNetease('/voicelist/list/search', params)
}

export function getVoiceListDetail(params = {}) {
  return getNetease('/voicelist/detail', params)
}

export function getVoiceListPrograms(params = {}) {
  return getNetease('/voicelist/list', params)
}

export function getVoiceDetail(params = {}) {
  return getNetease('/voice/detail', params)
}

export function getVoiceLyric(params = {}) {
  return getNetease('/voice/lyric', params)
}

export function getMyCreatedVoiceList(params = {}) {
  return getNetease('/voicelist/my/created', params)
}

export function getBroadcastCategoryRegion(params = {}) {
  return getNetease('/broadcast/category/region/get', params)
}

export function getBroadcastCollectList(params = {}) {
  return getNetease('/broadcast/channel/collect/list', params)
}

export function getBroadcastCurrentInfo(params = {}) {
  return getNetease('/broadcast/channel/currentinfo', params)
}

export function getBroadcastChannelList(params = {}) {
  return getNetease('/broadcast/channel/list', params)
}

export function updateBroadcastSubscribe(params = {}) {
  return getNetease('/broadcast/sub', params)
}

export function getDifmStyleChannels(params = {}) {
  return getNetease('/dj/difm/all/style/channel', params)
}

export function getDifmSubscribedChannels(params = {}) {
  return getNetease('/dj/difm/subscribe/channels/get', params)
}

export function subscribeDifmChannel(params = {}) {
  return getNetease('/dj/difm/channel/subscribe', params)
}

export function unsubscribeDifmChannel(params = {}) {
  return getNetease('/dj/difm/channel/unsubscribe', params)
}

export function getDifmPlayingTracks(params = {}) {
  return getNetease('/dj/difm/playing/tracks/list', params)
}

export function getSatiTimeSceneResources(params = {}) {
  return getNetease('/sati/timescene/resources/get', params)
}

export function getSatiTags(params = {}) {
  return getNetease('/sati/tag/list', params)
}

export function getSatiResources(params = {}) {
  return getNetease('/sati/resource/list', params)
}

export function getSatiMoreResources(params = {}) {
  return getNetease('/sati/resource/list/more', params)
}

export function getSatiSubscribedResources(params = {}) {
  return getNetease('/sati/resource/sub/list', params)
}

export function updateSatiSubscribe(params = {}) {
  return getNetease('/sati/resource/sub', params)
}

export function getSportRadio(params = {}) {
  return getNetease('/radio/sport/get', params)
}

export function checkSongLike(params = {}) {
  return getNetease('/song/like/check', params)
}

export function updateSongLike(params = {}) {
  return getNetease('/song/like', params)
}

export function getUserCreatedPlaylists(params = {}) {
  return getNetease('/user/playlist/create', params)
}

export function getUserCollectedPlaylists(params = {}) {
  return getNetease('/user/playlist/collect', params)
}

export function getSongDownloadList(params = {}) {
  return getNetease('/song/downlist', params)
}

export function getPlaylistDetail(params = {}) {
  return getNetease('/playlist/detail', params)
}

export function getPlaylistTracks(params = {}) {
  return getNetease('/playlist/track/all', params)
}

export function getPlaylistHotCategories(params = {}) {
  return getNetease('/playlist/hot', params)
}

export function getPlaylistCategories(params = {}) {
  return getNetease('/playlist/catlist', params)
}

export function getTopPlaylists(params = {}) {
  return getNetease('/top/playlist', params)
}

export function getHighQualityPlaylists(params = {}) {
  return getNetease('/top/playlist/highquality', params)
}

export function getToplist(params = {}) {
  return getNetease('/toplist', params)
}

export function getArtistList(params = {}) {
  return getNetease('/artist/list', params)
}

export function getArtistToplist(params = {}) {
  return getNetease('/toplist/artist', params)
}

export function getArtistDetail(params = {}) {
  return getNetease('/artist/detail', params)
}

export function getArtistHotSongs(params = {}) {
  return getNetease('/artists', params)
}

export function getArtistTopSongs(params = {}) {
  return getNetease('/artist/top/song', params)
}

export function getArtistSongs(params = {}) {
  return getNetease('/artist/songs', params)
}

export function getArtistAlbums(params = {}) {
  return getNetease('/artist/album', params)
}

export function getArtistMvs(params = {}) {
  return getNetease('/artist/mv', params)
}

export function getArtistVideos(params = {}) {
  return getNetease('/artist/video', params)
}

export function getArtistDesc(params = {}) {
  return getNetease('/artist/desc', params)
}

export function getArtistDynamic(params = {}) {
  return getNetease('/artist/detail/dynamic', params)
}

export function getAlbumNewest(params = {}) {
  return getNetease('/album/newest', params)
}

export function getNewAlbums(params = {}) {
  return getNetease('/album/new', params)
}

export function getTopAlbums(params = {}) {
  return getNetease('/top/album', params)
}

export function getAlbumDetail(params = {}) {
  return getNetease('/album', params)
}

export function getAlbumDynamic(params = {}) {
  return getNetease('/album/detail/dynamic', params)
}

export function getAlbumComments(params = {}) {
  return getNetease('/comment/album', params)
}

export function getPlaylistComments(params = {}) {
  return getNetease('/comment/playlist', params)
}

export function getCommentInfoList(params = {}) {
  return getNetease('/comment/info/list', params)
}

export function getLoginStatus(params = {}) {
  return getNetease('/login/status', params)
}

export function loginByCellphone(params = {}) {
  return getNetease('/login/cellphone', params)
}

export function loginByEmail(params = {}) {
  return getNetease('/login', params)
}

export function registerAnonymous(params = {}) {
  return getNetease('/register/anonimous', params)
}

export function refreshLogin(params = {}) {
  return getNetease('/login/refresh', params)
}

export function sendCaptcha(params = {}) {
  return getNetease('/captcha/sent', params)
}

export function verifyCaptcha(params = {}) {
  return getNetease('/captcha/verify', params)
}

export function getLoginQrKey(params = {}) {
  return getNetease('/login/qr/key', params)
}

export function getLoginQrCreate(params = {}) {
  return getNetease('/login/qr/create', params)
}

export function getLoginQrCheck(params = {}) {
  return getNetease('/login/qr/check', params, {
    acceptCodes: [800, 801, 802, 803]
  })
}

export function getUserAccount(params = {}) {
  return getNetease('/user/account', params)
}

export function logout(params = {}) {
  return getNetease('/logout', params)
}

export function getSongComments(params = {}) {
  return getNetease('/comment/music', params)
}

export function getSongRedCount(params = {}) {
  return getNetease('/song/red/count', params)
}

export function getSongUrl(params = {}) {
  return getNetease('/song/url/v1', params)
}

export function getLyric(params = {}) {
  return getNetease('/lyric', params)
}

export function getSearchDefault(params = {}) {
  return getNetease('/search/default', params)
}

export function getSearchHotDetail(params = {}) {
  return getNetease('/search/hot/detail', params)
}

export function getSearchSuggestPc(params = {}) {
  return getNetease('/search/suggest/pc', params)
}

export function getSearchMultiMatch(params = {}) {
  return getNetease('/search/multimatch', params)
}

export function getCloudSearch(params = {}) {
  return getNetease('/cloudsearch', params)
}
