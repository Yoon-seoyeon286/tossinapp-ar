import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'virtualme',
  brand: {
    displayName: '가상내짤', // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
    primaryColor: '#5E760A', // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
    icon: 'https://static.toss.im/appsintoss/19857/0459b250-2759-402d-8054-7da0a0c067cf.png', // 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요.
  },
  web: {
    host: '192.168.0.28',
    port: 3000,
    commands: {
      dev: 'node server.js',
      build: 'node build.js',
    },
  },
  permissions: [
    { name: 'camera', access: 'access' },
    { name: 'photos', access: 'write' },
  ],
  outdir: 'dist',
});
