
const pjson = require("./package.json");
const app_ver = pjson.version;
const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const {dialog} = require('electron');
const {copy, paste} = require('copy-paste')
const window = require('electron').BrowserWindow;
const dispatchUrl = require('./dispatcher').dispatchUrl;
const {ipcMain} = require('electron');
const {get_settings_string,set_settings_string,delete_settings} = require("./settings");

var userscripts = "";
// TODO: dynamic loading on user request
var logger = require('electron-log');
var devMenuOverride = false; 

const winSettings = {
  width: 800,
  height: 600,
  resizable: true,
  titleBarStyle: 'visible',
  show: false,
  webPreferences: { nodeIntegration: false, preload: path.join(__dirname,'preload.js'), nativeWindowOpen: true },
  icon: path.join(__dirname, 'assets/icons/64x64.png')
};

let mainWindow = null;

function getUserscriptInjectors() {
  var injectors = "";
  usc = userscripts.split(',');
  for (var i = 0; i < usc.length; i++) {
    injectors = injectors + "var script = document.createElement('script');\
    script.type = 'text/javascript';\
    script.src = '" + usc[i] + "';\
    var head = document.getElementsByTagName('head')[0];\
    if (!head) return;\
    head.appendChild(script);";
  }
  injectors = injectors + ";setTimeout(function a(){ document.querySelector(\"[data-a-target='settings-dropdown-link']\").outerHTML = document.querySelector(\"[data-a-target='settings-dropdown-link']\").outerHTML + \"<a class='tw-interactable' data-a-target='td-dropdown-link' href='javascript:td_settings()'><div class='tw-align-items-center tw-c-text-alt tw-flex tw-pd-x-2 tw-pd-y-05'><div class='tw-align-items-center tw-flex tw-mg-r-1'><svg class='tw-svg__asset tw-svg__asset--inherit tw-svg__asset--navsettings' width='18px' height='18px' version='1.1' viewBox='0 0 18 18' x='0px' y='0px'><path clip-rule='evenodd' d='M15.03,5.091v4.878l-2,2H8.151l-3.061,3.061L2.97,12.908l3.061-3.06V4.97l2-2h4.879L8.97,6.909l2.121,2.121L15.03,5.091z' fill-rule='evenodd'></path></svg></div><p class=''>Td settings</p></div></a>\"; },1000);";
  
  return injectors;
}

function injectScripts(window) {
  logger.debug("ready-to-show fired, attempt to inject userscripts");
  logger.debug("userscripts: " + userscripts);
  window.webContents.executeJavaScript("new Promise((r,x)=>{" + getUserscriptInjectors() + "r();})").then((r)=>{logger.debug("userscripts injected successfully");});
  window.show();
}

function newWindow(event,url) {
  logger.debug("new-window, url:" + url);
  if (url=="about:blank") return;
  event.preventDefault();
  const win = new BrowserWindow(winSettings)	
  win.loadURL(url);	
  win.on('ready-to-show', () => injectScripts(win));	
  win.webContents.on('new-window', newWindow);	
  win.on('closed', () => {	
    logger.debug('closing child');	
  });	
  event.newGuest = win;
  return;
}

const defaultSettings = {
  devmode: "1",
  sharelink: "1",
  safemode: "0",
  extensionslist: "https://cdn.betterttv.net/betterttv.js,https://cdn.frankerfacez.com/script/script.min.js,https://gist.githubusercontent.com/theeSpark/af59e64632ce7de8cf61dc0c716bb449/raw/231bb0b500bd7ae0ec66ef2450a5a57bf329d454/twitchlitch.js"
};

function init_settings() {
  Object.keys(defaultSettings).map((key) => {
    if (get_settings_string(key)=="undefined" || get_settings_string(key)==undefined) {
      set_settings_string(key, defaultSettings[key]);
    }
  });
  userscripts = get_settings_string("extensionslist");
}

function createWindow() {
  logger.transports.console.level = 'debug';
  logger.transports.file.level = 'debug';
  logger.transports.file.file = __dirname + '/log.txt';
  
  logger.debug("argv: " + process.argv);
  logger.info("Welcome to Td, version " + app_ver);
  console.log = logger.debug;
  mainWindow = new BrowserWindow(winSettings);
  const {app, Menu} = require('electron')
  init_settings();
  const template = [
    {
      label: 'Developer Menu',
      submenu: [
        {role: 'reload'},
        {role: 'forcereload'},
        {role: 'toggledevtools'},
        {label: 'Copy current URL', click() {wc=window.getFocusedWindow().webContents;copy(wc.history[wc.currentIndex])}},
        {label: 'Version', click() { dialog.showMessageBox({message: "Td version " + app_ver + "\nNode v" + process.versions.node + "\nClient v" + process.versions.electron + "\nRenderer v" + process.versions.chrome + "\nEngine v" + process.versions.v8, buttons: ["OK"] })}},
        {label: 'Settings...', click() { window.getFocusedWindow().webContents.executeJavaScript("td_settings()")}}
      ]
    },
  ];
  
  const menu = Menu.buildFromTemplate(template)
  mainWindow.setMenu(get_settings_string("devmode")=="1" || devMenuOverride ? menu : null);
  Menu.setApplicationMenu(get_settings_string("devmode")=="1" || devMenuOverride ? menu : null);
  var user = process.argv.length>=3 ? process.argv[2] : "";
  mainWindow.loadURL("https://www.twitch.tv/" + user);
  
  mainWindow.on('ready-to-show', () => {
    injectScripts(mainWindow)
  });
  
  mainWindow.webContents.on('new-window', newWindow);
  
  mainWindow.once('closed', () => {
    logger.debug("unloading");
    mainWindow = null;
  });
}



app.on('ready', createWindow);

app.on('window-all-closed', () => {
  logger.debug("window-all-closed, quitting");
  logger.info("App quit triggered, closing");
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null)
  createWindow();
});

const startTimestamp = new Date();


var share=true;


async function setActivity() {
  if (!rpc || !mainWindow)
  return;
  
  await mainWindow.webContents.executeJavaScript("new Promise((r,x)=>{\
    r(document.querySelector('[data-a-target=share-activity-toggle]').getAttribute('data-a-value')=='true');})").then((r)=>{
      share=r;
    }); 
    
    if (!share) {
    } else {
      const boops = await mainWindow.webContents.executeJavaScript('window.boops');
      logger.debug("Location: " + mainWindow.webContents.history[mainWindow.webContents.currentIndex])
      var status = dispatchUrl(mainWindow.webContents.history[mainWindow.webContents.currentIndex])
    }
  }
  
  const ws = {
    width: 800,
    height: 600,
    resizable: true,
    titleBarStyle: 'hidden',
    webPreferences: { nativeWindowOpen: true,  preload: path.join(__dirname,'ipc.js'), webSecurity: false },
    icon: path.join(__dirname, 'assets/icons/64x64.png'),
    
  };
  


  function showsettings() {
    nwin = new BrowserWindow(ws);
    //nwin.setMenu(null);
    
    nwin.loadURL(url.format({
      pathname: path.join(__dirname, 'assets', 'html', 'settings.html'),
      protocol: 'file:',
      slashes: true
    }));
    nwin.show();
  }
  
  rpc.on('ready', () => {
    setActivity();
    
    // activity can only be set every 15 seconds
    setInterval(() => {
      setActivity();
    }, 15e3);
  });
  
  logger.info("Attempt to connect to Discord RPC");
  rpc.login(ClientId).catch(logger.error);
  
  ipcMain.on('sync', (event,arg) => {
    logger.debug("Received synchronous RPC call " + arg);
    if (arg.length >=10 && arg.substring(0,9) == "gsettings") {
      event.returnValue = get_settings_string(arg.substring(10));
      return;
    };
    switch (arg) {
      case "app_ver":
        event.returnValue = app_ver;
        break;
      case "node_ver":
        event.returnValue = process.versions.node;
        break;
      case "electron_ver":
        event.returnValue = process.versions.electron;
        break;
      case "chrome_ver":
        event.returnValue = process.versions.chrome;
        break;
      case "v8_ver":
        event.returnValue = process.versions.v8;
        break;  
      default:
        logger.error("ERROR: no handler for RPC call " + arg);
        event.returnValue = null;
        break;
    }
  });

  ipcMain.on('async', (event, arg) => {
    logger.debug("Received asynchronous RPC call " + arg);

    if (arg.length >= 10 && arg.substring(0,9) == "wsettings") {
      set_settings_string(arg.substring(10, arg.indexOf(',')),arg.substring(arg.indexOf(',')+1));
      return;
    }
    switch (arg) {
      case "openSettings":
        showsettings();
        break;
        
      case "deleteSettings":
        delete_settings();
        break;
      default:
        logger.error("ERROR: no handler for RPC call " + arg);
        break;
    }
  });
  
