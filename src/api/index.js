const crypto = require('crypto');
const queryString = require('querystring');
const request = require('../utils/request').service;

const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const presetKey = Buffer.from('0CoJUm6Qyw8W8jud')
const iv = Buffer.from('0102030405060708')
const publicKey =
  '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.157' +
  ' Safari/537.36';
const COOKIE = 'os=pc; appver=2.9.7';
const REFERER = 'https://music.163.com';

// const __COOKIE__ = {
//   MUSIC_U: '8a0f2d6cefcecbfcb7cedd25718635e407c56ed13b600d4a7726c4f72513322f993166e004087dd3d78b6050a17a35e705925a4e6992f61dfe3f0151024f9e31',
//   __csrf: '8eb0f891d7786196e3768847d361f588'
// };

const aesEncrypt = (buffer, mode, key, iv) => {
  const cipher = crypto.createCipheriv('aes-128-' + mode, key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

const rsaEncrypt = (buffer, key) => {
  buffer = Buffer.concat([Buffer.alloc(128 - buffer.length), buffer])
  return crypto.publicEncrypt(
    {key: key, padding: crypto.constants.RSA_NO_PADDING},
    buffer,
  )
}

const encrypt = (object) => {
  const text = JSON.stringify(object)
  const secretKey = crypto
    .randomBytes(16)
    .map((n) => base62.charAt(n % 62).charCodeAt())
  return {
    params: aesEncrypt(
      Buffer.from(
        aesEncrypt(Buffer.from(text), 'cbc', presetKey, iv).toString('base64'),
      ),
      'cbc',
      secretKey,
      iv,
    ).toString('base64'),
    encSecKey: rsaEncrypt(secretKey.reverse(), publicKey).toString('hex'),
  }
}

function curl(url, data = {}, cookie = null) {
  const headers = {
    'Referer': REFERER,
    'Cookie': COOKIE,
    'User-Agent': USER_AGENT
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
  data = encrypt(data)
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
      .then(({data}) => {
        const {result} = data;
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
      .then(({data}) => {
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
    curl(URL, {logs: JSON.stringify(ids)}, cookie)
      .then(resolve)
      .catch(reject);
  });
}

/**
 * 签到
 * @param type 0 移动端 1 PC端
 * @param cookie
 * @return {Promise<AxiosResponse<any>>}
 */
function sign(type, cookie) {
  const URL = 'https://music.163.com/weapi/point/dailyTask';
  return curl(URL, { type }, cookie);
}

module.exports = {
  login,
  loginByEmail,
  sign,
  listen,
  detail
};
