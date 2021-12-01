const crypto = require('crypto');
const queryString = require('querystring');
const request = require('../utils/request').service;

const NONCE = '0CoJUm6Qyw8W8jud';
const PUB_KEY = '010001';
const VI = '0102030405060708';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.157' +
  ' Safari/537.36';
const COOKIE = 'os=pc; osver=Microsoft-Windows-10-Professional-build-10586-64bit; appver=2.0.3.131777; channel=netease;' +
  ' __remember_me=true;';
const REFERER = 'https://music.163.com/';
const SECRET_KEY = 'TA3YiYCfY2dDJQgg';
const ENC_SEC_KEY = '84ca47bca10bad09a6b04c5c927ef077d9b9f1e37098aa3eac6ea70eb59df0aa28b691b7e75e4f1f9831754919ea784c8f74fbfadf2898b0be17849fd656060162857830e241aba44991601f137624094c114ea8d17bce815b0cd4e5b8e2fbaba978c6d1d14dc3d1faf852bdd28818031ccdaaa13a6018e1024e2aae98844210';

// const __COOKIE__ = {
//   MUSIC_U: '8a0f2d6cefcecbfcb7cedd25718635e407c56ed13b600d4a7726c4f72513322f993166e004087dd3d78b6050a17a35e705925a4e6992f61dfe3f0151024f9e31',
//   __csrf: '8eb0f891d7786196e3768847d361f588'
// };

function aes_encode(secretData, secret) {
  const cipherChunks = [];
  const cipher = crypto.createCipheriv('aes-128-cbc', secret, VI);
  cipher.setAutoPadding(true);
  cipherChunks.push(cipher.update(secretData, 'utf8', 'base64'));
  cipherChunks.push(cipher.final('base64'));
  return cipherChunks.join('');
}

function curl(url, data = {}, cookie = null) {
  const headers = {
    referer: REFERER,
    Cookie: COOKIE
  };
  if (cookie) {
    if (typeof cookie === 'string') {
      headers.Cookie += ` ${cookie}`;
    }
    if (typeof cookie === 'object') {
      headers.Cookie += ` __csrf=${cookie['__csrf']}; MUSIC_U=${cookie['MUSIC_U']}`;
    }
  }
  data = data || {};
  if (data.csrf_token == null) {
    let csrfToken = (headers['Cookie'] || '').match(/_csrf=([^(;|$)]+)/);
    data.csrf_token = csrfToken ? csrfToken[1] : '';
  }
  data = {
    params: aes_encode(aes_encode(JSON.stringify(data), NONCE), SECRET_KEY),
    encSecKey: ENC_SEC_KEY
  };
  return request({
    url,
    method: 'POST',
    data: queryString.stringify(data),
    headers,
  })
    .then(resp => {
      const MUSIC_U = new RegExp('MUSIC_U=(.*?)\;').exec(resp.headers['set-cookie'])?.[1];
      const __csrf = new RegExp('__csrf=(.*?)\;').exec(resp.headers['set-cookie'])?.[1];
      if (MUSIC_U && __csrf) {
        resp.$cookie = {
          MUSIC_U,
          __csrf
        };
      }
      return resp;
    });
}

/**
 * 手机号登录
 * @param phone
 * @param password
 * @param countryCode
 * @param cookie
 * @return {Promise<AxiosResponse<any>>}
 */
function login(phone, password, countryCode = '86', cookie) {
  const URL = 'https://music.163.com/weapi/login/cellphone';
  const data = {
    phone,
    countrycode: countryCode,
    password,
    rememberLogin: 'true'
  };
  return curl(URL, data, cookie);
}

/**
 * 邮箱登录
 * @param username
 * @param password
 * @param cookie
 * @return {Promise<AxiosResponse<any>>}
 */
function loginByEmail(username, password, cookie) {
  const URL = 'https://music.163.com/weapi/login';
  const data = {
    username,
    password,
    rememberLogin: 'true'
  };
  return curl(URL, data, cookie);
}

/**
 * 用户详情
 * @param uid
 * @param cookie
 * @return {Promise<AxiosResponse<any>>}
 */
function detail(uid, cookie) {
  const URL = `https://music.163.com/weapi/v1/user/detail/${uid}`;
  return curl(URL, {}, cookie);
}

/**
 * 获取推荐歌单
 * @param limit
 * @param cookie
 * @return {Promise<unknown>}
 */
function personalized(limit, cookie) {
  const URL = 'https://music.163.com/weapi/personalized/playlist';
  return new Promise(resolve => {
    curl(URL, {
      limit,
      total: 'true',
      n: 1000
    }, cookie)
      .then(({ data }) => {
        const { result } = data;
        resolve((result || []).map(r => r.id));
      });
  });
}

/**
 *
 * @param playlist_id
 * @param cookie
 * @return {Promise<unknown>}
 */
function getSongId(playlist_id, cookie) {
  const URL = 'https://music.163.com/weapi/v6/playlist/detail?csrf_token=';
  return new Promise(resolve => {
    curl(URL, {
      id: playlist_id,
      n: 1000,
      csrf_token: ''
    }, cookie)
      .then(({ data }) => {
        resolve(data.playlist.trackIds);
      });
  });
}

/**
 * 自动听歌
 * @param cookie
 * @return {Promise<unknown>}
 */
function listen(cookie) {
  return new Promise(async (resolve, reject) => {
    const playlist = await personalized(100, cookie);
    const ids = [];
    for (let i = 0; ids.length < 1000; i++) {
      const songId = await getSongId(playlist[Math.floor(Math.random() * playlist.length)], cookie);
      for (let j = 0; ids.length < 1000 && j < songId.length; j++) {
        ids.push({
          action: 'play',
          json: {
            download: 0,
            end: 'playend',
            id: songId[j].id,
            sourceId: '',
            time: 240,
            type: 'song',
            wifi: 0
          }
        });
      }
    }
    const URL = 'https://music.163.com/weapi/feedback/weblog';
    curl(URL, { logs: JSON.stringify(ids) }, cookie)
      .then(resolve)
      .catch(reject);
  });
}

/**
 * 签到
 * @param cookie
 * @return {Promise<AxiosResponse<any>>}
 */
function sign(cookie) {
  const URL = 'https://music.163.com/weapi/point/dailyTask';
  return curl(URL, { type: 0 }, cookie);
}

module.exports = {
  login,
  loginByEmail,
  sign,
  listen,
  detail
};
