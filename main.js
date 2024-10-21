const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sudo = require('sudo-prompt');

let win;
const hostsFilePath = '/etc/hosts';

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  win.webContents.on('did-finish-load', () => {
    loadHostsFile();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function loadHostsFile() {
  fs.readFile(hostsFilePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('Failed to read /etc/hosts:', err);
      win.webContents.send('load-hosts-file', '');
      return;
    }
    win.webContents.send('load-hosts-file', data);
  });
}

ipcMain.on('save-hosts-file', (event, content) => {
  const options = { name: 'Hosts Manager' };
  const command = `echo "${content.replace(/"/g, '\\"')}" | sudo tee ${hostsFilePath}`;

  sudo.exec(command, options, (error, stdout, stderr) => {
    if (error) {
      console.error('Error saving /etc/hosts:', error);
      event.reply('save-status', { success: false, message: error.message });
      return;
    }
    event.reply('save-status', { success: true });
    loadHostsFile();
  });
});
