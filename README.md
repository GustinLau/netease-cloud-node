# 网易云音乐自动听歌脚本

这是一个通过调用网易云音乐官方接口，每日听满300首歌曲项目。

## 灵感来自

[ZainCheung/netease-cloud](https://github.com/ZainCheung/netease-cloud)

## 运行

### GitHub Actions

1. fork项目

2. 添加账号信息

   ![添加账号信息](https://z3.ax1x.com/2021/12/02/oNyKAJ.png)
   1. 其中`NETEASE_ACCOUNT`和`NETEASE_PASSWORD`为必填项，`PUSH_SCKEY`为可选项
   2. `NETEASE_ACCOUNT`为网易云账号（邮箱或手机号）
   3. `NETEASE_PASSWORD`为`MD5`加密后密码
   4. `PUSH_SCKEY`为Server酱免费版密匙,不需要推送则不填写。[免费申请](https://sct.ftqq.com/login)

4. 启用Action
   1. 手动启动
      ![手动启动](https://z3.ax1x.com/2021/12/02/oNytBD.png)
   2. 定时任务

      编辑`.github/workflows/main.yml`中的`schedule->on->cron`，设定执行时间。

### 本地运行

1. 下载项目

    克隆项目到本地
    ```bash
   git clone https://github.com/GustinLau/netease-cloud-node.git
    ```
    或者直接下载压缩包

2. 安装依赖

    ```bash
   npm install
    ```

3. 配置信息

    修改目录下`init.yaml`配置文件

4. 启动程序
    ```bash
   npm start
    ```

## 声明

本项目的所有脚本以及软件仅用于个人学习开发测试，所有`网易云`相关字样版权属于网易公司，勿用于商业及非法用途，因刷歌导致的损失及产生法律纠纷与本人无关。
