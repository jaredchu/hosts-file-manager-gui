const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sudo = require('sudo-prompt');
const { exec } = require('child_process');

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

app.disableHardwareAcceleration();
app.whenReady().then(() => {
  fixFilePermission();

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

function fixFilePermission() {
  // Ensure the hosts file has the right ownership and permissions
  const currentUser = process.env.USER;
  const options = { name: 'Hosts Manager' };

  // Check if the file belongs to root:$USER
  exec(`stat -c "%U:%G" ${hostsFilePath}`, (error, stdout) => {
    if (error) {
      console.error('Failed to get file ownership:', error);
      return;
    }
    const ownership = stdout.trim();
    if (ownership !== `root:${currentUser}`) {
      // Change ownership to root:$USER if not already
      sudo.exec(`chown root:${currentUser} ${hostsFilePath}`, options, (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to change ownership:', error);
          return;
        }
      });
    }
  });

  // Check if the file has 664 permissions
  exec(`stat -c "%a" ${hostsFilePath}`, (error, stdout) => {
    if (error) {
      console.error('Failed to get file permissions:', error);
      return;
    }
    const permissions = stdout.trim();
    if (permissions !== '664') {
      // Change permissions to 664 if not already
      sudo.exec(`chmod 664 ${hostsFilePath}`, options, (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to change file permissions:', error);
          return;
        }
      });
    }
  });
}

ipcMain.on('save-hosts-file', async (event, content) => {
  try {
    await fs.promises.writeFile(hostsFilePath, content.replace(/"/g, '\\"'), 'utf-8');
    event.reply('save-status', { success: true });
    loadHostsFile();
  } catch (error) {
    console.error('Error saving /etc/hosts:', error);
    event.reply('save-status', { success: false, message: error.message });
  }
});
