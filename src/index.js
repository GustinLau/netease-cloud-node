const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const axios = require('./utils/request').service;
const queryString = require('querystring');
const moment = require('moment');
const {
  loginByEmail,
  login,
  sign,
  detail,
  listen
} = require('./api');

const GRADE = [10, 40, 70, 130, 200, 400, 1000, 3000, 8000, 20000];

class Task {

  setting;
  cookie;
  user;
  listenCount;
  songCount;
  day;
  logs;
  error;

  /**
   * 初始化
   * @return {Promise<unknown>}
   */
  init() {
    this.cookie = null;
    this.user = {};
    this.logs = [];
    this.error = null;
    this.listenCount = 0;
    this.songCount = 0;
    this.day = 0;
    this.setting = null;
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV === 'GITHUB') {
        this.setting = {
          user: {
            'account': process.env.NETEASE_ACCOUNT ?? '',
            'password': process.env.NETEASE_PASSWORD ?? '',
            'country-code': process.env.COUNTRY_CODE ?? 86
          },
          push: {
            'sckey': process.env.PUSH_SCKEY ?? ''
          }
        };
      } else {
        this.setting = yaml.load(fs.readFileSync(path.resolve('init.yml'), 'utf8'));
      }
      if (this.verifySetting()) {
        this.log('初始化完成');
        resolve();
      } else {
        this.log('初始化失败');
        reject('配置缺失');
      }
    });
  }

  /**
   * 验证配置
   * @return {boolean}
   */
  verifySetting() {
    return !!this.setting && !!this.setting.user && !!this.setting.user.account && !!this.setting.user.password;

  }

  /**
   * 请求接口
   * @param action 接口方法
   * @param params 接口参数
   * @return {*}
   */
  request(action, ...params) {
    return action.apply(null, [...params, this.cookie]);
  }

  /**
   * 日志
   * @param texts
   */
  log(...texts) {
    for (const text of texts) {
      this.logs.push(`- ${moment().utcOffset(8).format('HH:mm:ss')} ${text}`);
      console.log(text);
    }
  }

  /**
   * 登录
   * @return {Promise<unknown>}
   */
  login() {
    return new Promise((resolve, reject) => {
      const { user } = this.setting;
      let request;
      if (user.account.includes('@')) {
        request = this.request(loginByEmail, user['account'], user['password']);
      } else {
        request = this.request(login, user['account'], user['password'], user['country-code']);
      }
      request
        .then(resp => {
          const { data } = resp;
          if (data.code === 200) {
            this.cookie = resp.$cookie;
            this.user = {
              uid: data.account.id,
              name: data.profile.nickname
            };
            this.log('登录成功');
            resolve();
          } else {
            this.log('登录失败');
            reject('登录失败---' + data.msg || data.message);
          }
        })
        .catch(e => {
          this.log('登录失败');
          reject(e);
        });
    });

  }

  /**
   * 每日签到
   * @param type
   * @return {Promise<unknown>}
   */
  sign(type) {
    return new Promise((resolve) => {
      this.request(sign, type)
          .then(resp => {
            const { data } = resp;
            if (data.code === 200) {
              this.log(`${type === 0 ? '移动端' : 'PC端'}签到成功，获得云贝${data.point}`);
              resolve(true);
            } else {
              this.log(`${type === 0 ? '移动端' : 'PC端'}重复签到`);
              resolve(false);
            }
          })
          .catch(() => {
            this.log(`${type === 0 ? '移动端' : 'PC端'}签到失败`);
            resolve(false);
          });
    });
  }

  /**
   * 听歌
   * @param time
   * @return {Promise<unknown>}
   */
  listen(time) {
    return new Promise((resolve, reject) => {
      this.request(listen)
          .then(resp => {
            const { data } = resp;
            if (data.code === 200) {
              this.log(`第${time}次听歌成功`);
              resolve(true);
            } else {
              this.log(`第${time}次听歌失败`);
              reject(data.msg || data.message);
            }
          })
          .catch(e => {
            this.log(`第${time}次听歌失败`);
            reject(e);
          });
    });
  }

  /**
   * 用户详情
   */
  detail() {
    return new Promise((resolve, reject) => {
      this.request(detail, this.user.uid)
          .then(resp => {
            const { data } = resp;
            if (data.code === 200) {
              this.user.level = data.level;
              this.user.listenSongs = data.listenSongs;
              resolve(data);
            } else {
              this.log('获取用户详情失败');
              reject('获取用户详情失败---' + data.msg || data.message);
            }
          })
          .catch(e => {
            this.log('获取用户详情失败');
            reject(e);
          });
    });
  }

  /**
   * Server酱推送
   * @return {Promise<unknown>}
   */
  serverPush() {
    return new Promise(resolve => {
      const { push } = this.setting;
      if (!push.sckey) {
        return;
      }
      this.log('推送消息');
      let tip = '';
      let title = '';
      let content = [];
      let state = '';
      for (const number of GRADE) {
        if (this.user.level < 10) {
          if (this.user.listenSongs < 20000) {
            tip = `还需听歌${number - this.user.listenSongs}首即可升级`;
          } else {
            tip = '你已经听够20000首歌曲,如果登录天数达到800天即可满级';
          }
        } else {
          tip = '恭喜你已经满级!';
        }
      }
      if (!this.error) {
        title = `网易云今日听歌${this.songCount}首，已播放${this.user.listenSongs}首`;
        state = [
          '- 已完成签到',
          `- 今日共听歌${this.listenCount}次`,
          `- 今日共播放${this.songCount}首歌`,
          `- 还需要听歌${this.day}天`
        ].join('\n');
      } else {
        title = '网易云听歌任务出现问题！';
        state = '' +
          '```\n' +
          this.error.toString() + '\n' +
          '```\n' +
          '';
      }

      if (!this.error) {
        content.push(...[
          '------',
          '#### 账户信息',
          `- 用户名称：${this.user.name}`,
          `- 当前等级：${this.user.level}级`,
          `- 累计播放：${this.user.listenSongs}首`,
          `- 升级提示：${tip}\n`,
          '------',
        ]);
      }
      content.push(...[
        '#### 任务状态',
        `${state}\n`,
        '------',
        '#### 注意事项',
        '- 网易云音乐等级数据每天下午2点更新\n',
        '- 听歌是指累计播放歌曲数而非播放次数\n',
        '------',
        '#### 执行日志',
        `${this.logs.join('\n')}\n`
      ]);
      axios({
        url: `http://sc.ftqq.com/${push.sckey}.send`,
        method: 'POST',
        data: queryString.stringify({
          text: title,
          desp: content.join('\n')
        })
      })
        .then(resp => {
          const { data } = resp;
          if (data.data.errno === 0) {
            this.log('Server酱推送成功');
            resolve(true);
          } else {
            this.log('Server酱推送失败');
            resolve(false);
          }
        })
        .catch(e => {
          this.log('Server酱推送失败', e.response.data.info);
          resolve(false);
        });
    });
  }

  /**
   * 执行听歌任务
   */
  async start() {
    new Promise(async resolve => {
      try {
        await this.init();
        await this.login();
        await this.sign(0);
        await this.sign(1);
        const detail = await this.detail();
        this.log(`当前账号云贝数：${detail.userPoint.balance}`);
        const counter = this.user.listenSongs;
        if (counter < 20000) {
          this.log(`当前账号听歌量${counter}，开始听歌`);
          const total = 10;
          for (let i = 0; i < total; i++) {
            await this.listen(i + 1);
            this.listenCount++;
            this.log('等待10秒');
            await new Promise(resolve => setTimeout(resolve, 10 * 1000));
            await this.detail();
            this.songCount = this.user.listenSongs - counter;
            this.log(`今天已播放${this.songCount}首`);
            if (this.songCount >= 300) {
              break;
            }
          }
          if (this.user.listenSongs >= 20000) {
            this.day = 0;
          } else {
            this.day = Math.ceil((20000 - this.user.listenSongs) / 300);
          }
          this.log('听歌结束');
        } else {
          this.log(`当前账号听歌量${counter}，不再执行听歌任务`);
        }
        resolve();
      } catch (e) {
        this.error = e;
        this.log('听歌结束');
        console.error(e);
        resolve();
      }
    })
      .then(() => this.serverPush());
  }
}

module.exports = {
  Task
};
