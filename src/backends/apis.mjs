const baseAPI = "https://dev-deviceapi.cluemaster.io";

const generalRequestAPI = baseAPI + "/api/Device/GetGeneralRequest";
const devicesFilesAPI = baseAPI + "/api/Device/GetDeviceFiles/{device_unique_code}";
const generateAPITokenAPI = baseAPI + "/api/Auth/PostGenerateApiKey";
const roomInfoAPI = baseAPI + "/api/Device/GetRoomInfo/{device_unique_code}";
const deviceRequestAPI = baseAPI + "/api/Device/GetDeviceRequest/{device_unique_code}";
const getTimerRequestAPI = baseAPI + "/api/Device/GetTimerRequest/{}";
const getGameStartEndTimeAPI = baseAPI + "/api/Device/GetGameTimerStartEndTime/{}";
const gameDetailsAPI = baseAPI + "/api/Device/GetGameDetails/{}";
const gameIntroRequestAPI = baseAPI + "/api/Device/GetGameIntroRequest/{}";
const getGameTimerAPI = baseAPI + "/api/Device/GetGameTimer/{}";
const identifyDeviceAPI = baseAPI + "/api/Device/IdentifyDevice/{device_unique_code}";
const shutdownRestartRequestAPI = baseAPI + "/api/Device/GetShutdownRestartRequest/{unique_code}";
const gameClueAPI = baseAPI + "/api/Device/GetGameClue/{initial_gameId}";
const downloadFilesRequestAPI = baseAPI + "/api/Device/DownloadFilesRequest/{unique_code}";
const getDeviceExistAPI = baseAPI + "/api/Device/GetDeviceExist/{unique_code}";
const getVideoPlayerFilesAPI = baseAPI + "/api/Device/GetVideoPlayerFiles/{device_unique_code}"

const postGameClueStatusAPI = baseAPI + "/api/Device/PostGameClueStatus/{game_ids}/{clue_ids}";
const postGameClueAPI = baseAPI + "/api/Device/PostGameClue/{gameId}/{gameClueId}";
const postDeviceAPI = baseAPI + "/api/Device/{device_unique_code}/{deviceRequestId}";
const postDeviceDetailsUpdateAPI = baseAPI + "/api/Device/PostDeviceDetailsUpdate/{device_id}/{device_ip}/{snap_version}";
const postDeviceHeartBeatAPI = baseAPI + "/api/Device/PostDeviceHeartBeat/{device_id}/{cpu_avg}/{memory_avg}/{network_avg}"

export {
  baseAPI,
  generalRequestAPI,
  devicesFilesAPI,
  generateAPITokenAPI,
  roomInfoAPI,
  deviceRequestAPI,
  getTimerRequestAPI,
  getGameStartEndTimeAPI,
  gameDetailsAPI,
  gameIntroRequestAPI,
  getGameTimerAPI,
  identifyDeviceAPI,
  shutdownRestartRequestAPI,
  gameClueAPI,
  downloadFilesRequestAPI,
  getDeviceExistAPI,
  getVideoPlayerFilesAPI,
  postGameClueStatusAPI,
  postGameClueAPI,
  postDeviceAPI,
  postDeviceDetailsUpdateAPI,
  postDeviceHeartBeatAPI
};
