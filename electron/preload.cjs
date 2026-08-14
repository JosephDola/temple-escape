const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('templeDesktop', {
  desktop: true,
  platform: process.platform,
  arch: process.arch
});
