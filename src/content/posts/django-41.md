---
title: Nginx Proxy Manager使用教程 - 星空小站
published: 2026-02-10
pinned: false
description: "【玩转Docker】反向代理神器：Nginx Proxy Manager 一、什么是反向代理？ 众所周知，浏览器访问网页需要域名:端口号或者IP:端口号这种形式，而当你访问页面时不输入端口号时，浏览器会根据HTTP协议或者HTTPS协议，自动在后面加上默认端口号80或者443。 但是我这种小白使用服"
tags: []
category: 技术
draft: false
---

【玩转Docker】反向代理神器：Nginx Proxy Manager
一、什么是反向代理？
众所周知，浏览器访问网页需要域名:端口号或者IP:端口号这种形式，而当你访问页面时不输入端口号时，浏览器会根据HTTP协议或者HTTPS协议，自动在后面加上默认端口号80或者443。

但是我这种小白使用服务器搭建服务时，一个服务器上往往有多种Web服务。端口又不能复用，所以其他服务都是需要域名:端口号或者IP:端口号这种形式来访问。于是，我就有一个疑问了，能不能用不同的域名来对应不同的服务呢。

那这就是反向代理的作用了。

反向代理类似于一个菜鸟驿站。邮局（互联网）对于地址（域名）是每个咱们小区（服务器）的包裹（数据报文）都直接发给咱们小区的菜鸟驿站（反向代理服务器），然后菜鸟驿站根据每个包裹地址（域名）然后交付给咱们小区的具体家庭（服务器中的每一个服务）。

反向代理的作用
反向代理的作用

而Nginx则作为非常有名的反向代理Web服务器，被广大站长采用。Nginx功能十分强大，但是对于小白来说，配置还是有一些门槛。那么有没有一款基于Nginx的Web管理界面，来设置Nginx的反向代理呢？

那就是这款神器：Nginx Proxy Manager。

二、Nginx Proxy Manager有什么功能？
以下是Nginx Proxy Manager的官网介绍：

"This project comes as a pre-built Docker image that enables you to easily forward to your websites running at home or otherwise, including free SSL, without having to know too much about Nginx or Let's Encrypt."

该项目作为一个预构建的Docker镜像提供，使您能够轻松地转发到在家里或其他地方运行的网站，包括免费的SSL，而无需对Nginx或Let's Encrypt有太多了解。

它的功能总结起来就是以下几点：

轻松的反向代理设置
轻松配置HTTPS
提供简单的访问权限设置
好了，talk is cheap。接下来进入Nginx Proxy Manager一系列实战操作，让我们玩转Nginx Proxy Manager！

三、Nginx Proxy Manager的安装
1. 前提
安装Docker和Docker Compose
2. 安装
SSH连接上服务器后，新建一个名为ngingx_proxy_manager的文件夹用来存放文件和数据（最好建一个统一存放各种Docker容器应用的目录，例如本人命名为docker文件夹）

bash
cd ~/docker/
mkdir ngingx_proxy_manager && cd ngingx_proxy_manager
新建docker-compose.yml，文件并复制以下内容:
yml
# 编辑文件
vim docker-compose.yml

# 复制以下内容
version: "3"
services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      # These ports are in format <host-port>:<container-port>
      - '80:80' # Public HTTP Port
      - '443:443' # Public HTTPS Port
      - '81:81' # Admin Web Port
      # Add any other Stream port you want to expose
      # - '21:21' # FTP
    environment:
      DB_MYSQL_HOST: "db"
      DB_MYSQL_PORT: 3306
      DB_MYSQL_USER: "npm"
      DB_MYSQL_PASSWORD: "npm"
      DB_MYSQL_NAME: "npm"
      # Uncomment this if IPv6 is not enabled on your host
      # DISABLE_IPV6: 'true'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    depends_on:
      - db

  db:
    image: 'jc21/mariadb-aria:latest'
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: 'npm'
      MYSQL_DATABASE: 'npm'
      MYSQL_USER: 'npm'
      MYSQL_PASSWORD: 'npm'
    volumes:
      - ./data/mysql:/var/lib/mysql

或者指定版本运行

docker-compose
version: '3.8'
services:
  app:
    image: 'jc21/nginx-proxy-manager:2.9.22'
    restart: always  # Add this line
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
启动服务
bash
docker-compose up -d
在确保云服务器防火墙已经放行80、81和443端口后即可访问服务器ip:81进入ngingx_proxy_manager的Web管理界面。默认密码为：

bash
Email: admin@example.com
Password: changeme
输入密码后，进入后台后会强制要求更改用户名和密码。

实战一、设置后台管理界面的反向代理
在前文中，已介绍了反向代理的作用，即常见的需求是输入ip:port形式访问界面太不优雅，并且无法设置HTTPS，因此需要用一个域名与此绑定。用户浏览器输入域名，服务器会根据此域名自动转发请求报文到对应绑定的ip:port服务，然后将响应报文回复给用户。

这里，我们就用http://a.test.com来绑定我们的端口号为81的后台管理界面，实现浏览器输入http://a.test.com即可访问后台管理界面，并且设置HTTPS。

1. 前提
安装好Nginx Proxy Manager
拥有一个域名
将http://a.test.com解析到安装Nginx Proxy Manager的服务器IP地址上
2. 反向代理操作
先用ip:81访问后台管理界面，然后输入账号密码进入后台。

点击绿色图标的选项:

设置反向代理
设置反向代理

点击右边的Add Proxy Host，在弹出的界面的Details选项中填写相应的字段。

Domain Names: 填写要反向代理的域名，这里就是http://a.test.com

Forward Hostname / IP: 填写的IP值见下文解释

Forward Port: 反向代理的端口，这里就是81

Block Common Exploits: 开启后阻止一些常见漏洞

其余两个暂不知作用。

Forward Hostname / IP填写说明
如果搭建的服务和Nginx Proxy Manager服务所在不是一个服务器，则填写能访问对应服务的IP。
如果都在同一台服务器上，则填写在服务器中输入ip addr show docker0命令获取得到的IP。
image.png

查看宿主机IP
这里不填写127.0.0.1的原因是使用的是Docker容器搭建Web应用，Docker容器和宿主机即服务器不在同一个网络下，所以127.0.0.1并不能访问到宿主机，而ip addr show docker0获得的IP地址就是宿主机地址。

反代设置细节
反代设置细节
接下来即可用a.test.com访问后台管理界面，此时还只是HTTP协议，没有HTTPS。不过此时就可以把之前的81端口关闭了，输入a.test.com访问的是服务器80端口，然后在转发给内部的81端口。

3. 申请泛域名SSL证书
就是申请一个*.test.com证书，这样二级域名无论是什么都可以用这个证书，不需要一个二级域名申请一个。

在Nginx Proxy Manager管理后台，选择Access Lists->Add SSL Certificate->Let's Encrypt选项。

SSL管理
SSL管理

Domain Names中填写*.test.com和test.com，打开Use a DNS Challenge选项，并选择个人域名的DNS解析服务商（本人就是腾讯的DNSPod），最后填入服务商提供的API Key或者Token。

DNSPod的ID和Key获取教程：

进入DNSPod控制台
密钥管理（如图）
DNSPod密钥管理
DNSPod密钥管理

随便取一个名字后，复制ID和Token到对应位置。
获取密钥
获取密钥

SSL全部设置
SSL全部设置

4. 设置HTTPS
进入反向代理设置界面，编辑上文创建的反代服务，选择SSL选项，下拉菜单中选择我们申请的证书，然后可以勾选Force SSL即强制HTTPS。

选择相应的证书
选择相应的证书

同理，以后新创建的反向代理可以直接在SSL选项中选择我们刚刚申请的泛域名证书。

更新线-v2.9.19及以上版本存在的问题：SSL过期重新配置DNSPod时，报错异常

注意

v2.9.19 以上的版本需要安装依赖zope：

bash
python3 -m pip install --upgrade pip
pip install certbot-dns-dnspod
pip install zope
v2.9.20 则有授权列表新增编辑错误的问题 推荐v2.9.22

具体步骤

编辑 docker-compose.yml 文件，指定版本为 2.9.22
关闭服务：docker-compose down
选删：docker rm xxxx
启动：docker-compose up -d
进入容器：docker exec -it <容器名> /bin/bash
执行上述安装指令
实战二、搭建服务器监控并用NPM设置密码访问
下面再通过用Docker搭建的小而美的服务器监控，来介绍Nginx Proxy Manager添加权限访问的操作。

1. 小而美的服务器状态监控：Ward
Ward is a simple and minimalistic server monitoring tool. Ward supports an adaptive design system and also it supports a dark theme. It shows only principal information and can be used if you want to see a nice-looking dashboard instead of looking at a bunch of numbers and graphs. Ward works nicely on all popular operating systems because it uses OSHI.

Ward是一个简单且最低限度的服务器监控工具。Ward支持自适应设计系统。它还支持黑暗主题。如果您想看到漂亮的仪表板，而不是查看一堆数字和图形，那么它只显示主要信息，并且可以使用。Ward在所有流行的操作系统上都运行良好，因为它使用OSHI。

2. 前提
安装好Nginx Proxy Manager
拥有一个域名
将http://b.test.com解析到安装Nginx Proxy Manager的服务器IP地址上
3. 安装
SSH连接上服务器后，新建一个名为ward的文件夹用来存放文件和数据（最好建一个统一存放各种Docker容器应用的目录，例如本人命名为docker文件夹）

bash
cd ~/docker/
mkdir ward && cd ward
新建docker-compose.yml文件并复制以下内容 编辑文件 vim docker-compose.yml 并复制以下内容：

yml
version: '3.3'
services:
  run:
    restart: unless-stopped
    container_name: ward
    ports:
      - '4000:4000'  # 第一个4000表示外部可访问的端口，可修改
    environment:
      - WARD_PORT=4000  # 和上面后一个端口号相同
      - WARD_THEME=dark  # 可选light或者dark
      - WARD_NAME=leons-server  # 网站名称，可修改
    privileged: true
    image: antonyleons/ward
启动服务

bash
docker-compose up -d
4. 设置反向代理和SSL
打开Nginx Proxy Manager的管理页面。新建反向代理，Details填写如上文。

5. 权限设置
在Nginx Proxy Manager管理首页，选"Access Lists"页面->点击"Add Access List"。

image.png

Detail页面

反代设置细节
detail设置

Name: 这个权限设置的名称

Satisfy Any: Access选项条件满足任意即可访问

Pass Auth to Host: 暂不知作用

image.png

Authorization：可设置多个账户密码

Access：可设置IP白、黑名单。

最后保存即可，然后在设置反向代理界面Details->Access List选择刚刚设置的权限选项。

image.png

权限设置，以后想设置权限的都可以选择该权限选项。

最后效果如下：

image.png

三、其他更新问题
1、minio桶列表加载无法展示
更新线——解决：部署minio文件管理服务时，进入管理页面后发现桶列表打不开的问题

问题描述

使用Nginx给minio做端口代理转发 进入管理界面查看桶一直显示loading问题

按F12查看了一下，查看桶发起的是 websocket 请求

conf
# 添加了websocket支持
proxy_http_version      1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_next_upstream     http_500 http_502 http_503 http_504 error timeout invalid_header;
proxy_set_header        Host  $http_host;
proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
但我们是Nginx proxy Manager，有两种方式配置，一种开启websocket支持，一种添加自定义Nginx配置

开启websocket
开启websocket

自定义配置
自定义配置

开启websocket
开启websocket之后

2、部署nacos如何自定义具备后缀的路径
更新线——解决：部署nacos时，由于需要nacos后缀，控制台打不开的问题

添加自定义配置

conf
    location / {
        proxy_pass      http://IP:8848/nacos/;
        proxy_set_header Host $http_host;
        proxy_redirect  http:// https://;

        proxy_set_header X-Forwarded-Host $http_host; 
        proxy_set_header X-Forwarded-Port  $server_port; 
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Scheme $scheme;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $remote_addr;

        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection $http_connection;
        proxy_http_version 1.1;
    }
自定义配置
自定义配置

3、重定向Html
示例：如试图从http://xx.golovin.cn/ 跳转到http://xx.golovin.cn/xxx/index.html

设置 Nginx Proxy Manager 以重定向到指定页面的步骤：

打开 Nginx Proxy Manager

访问 Nginx Proxy Manager 的管理界面。
配置 Proxy Hosts

点击 “Proxy Hosts” 选项。
找到并编辑您的代理主机，即 xxx.golovin.cn。
添加自定义位置

点击 “Custom Locations” 标签。

添加两个自定义位置：

Custom Location 1:

Location: /
Scheme: http
Forward Hostname / IP: 192.168.255.1
Forward Port: 8888
Advanced Configuration:
nginx
rewrite ^/$ /config/index.html redirect;
这条重写规则会将根目录的访问重定向到 /xxxx/index.html。
Custom Location 2:

Location: /xxxx/
Scheme: http
Forward Hostname / IP: 192.168.255.1
Forward Port: 8888
确保这个位置正常转发，无需额外的重写规则。
验证配置

保存并应用更改后，访问 http://xxxx.golovin.cn/ 确认是否正确跳转到 http://xxxx.golovin.cn/xxxx/index.html。
如果跳转不成功，请检查 Nginx Proxy Manager 是否已经正确重启，以及检查配置是否有误。
问题排查

如果重定向仍未按预期工作，检查 Nginx Proxy Manager 的日志以确定可能的配置错误或网络问题。
通过上述配置，您的服务器应当能够正确处理来自 xxxx.golovin.cn 的请求，并根据设置自动重定向到指定的 URL。

image.png

4、docker-compose down关闭后重启登录失败问题
重启docker无事，若docker-compose down再启动 则会登录报错 bad gateway 官网上查和日志排查大概就是一个很蠢的bug，下载一个json配置会存在问题：

log
When I installed npm and logged in, 502 bad gateway appeared

I have tried to replace the image version and change the installation location. 
A problem was found when the npm mirror was started 
he got stuck at Fetching https://ip-ranges.amazonaws.com/ip-ranges.json
执行下述代码下载到本地即可解决：

bash
NPM_CTR_NAME=nginx-docker-app-1
docker exec $NPM_CTR_NAME sed -i 's/\.then(internalIpRanges\.fetch)//g' /app/index.js
docker restart $NPM_CTR_NAME
解释

通过修改应用的 JavaScript 代码，去掉了从 Amazon IP ranges 获取数据的步骤。这个方法有效地绕开了网络请求的问题

其他可能的解决方案

确保网络通畅
• 确认 Docker 容器能够正常访问外部网络。这包括确保任何网络代理或 VPN 都已正确配置，以允许容器访问 https://ip-ranges.amazonaws.com。

使用网络调试工具
• 使用工具如 curl 或 traceroute 从容器内部检查到 ip-ranges.amazonaws.com 的连通性。

优化 Docker 网络配置
• 检查 Docker 网络设置，确保 DNS 正确配置，并且网络模式（如桥接、主机等）不会限制容器的外部访问。

持久化修复
• 如果决定继续使用代码修改方式绕过问题，可以考虑将修改后的 index.js 文件制作成一个补丁，并在 Dockerfile 中添加步骤自动应用这个补丁，以确保重建容器时自动应用这些更改。