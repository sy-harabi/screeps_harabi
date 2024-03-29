global.data = {};
data.creeps = {};
data.time = new Date().getTime();
data.tick = Game.time;
data.terminalOrder = 0;

/**
 * record log to the memory.
 * @param {string} text - text to log
 * @param {string} roomName - roomName to link
 * @param {number} groupInterval - grouped with other notifications using the specified time in minutes. default is 180
 */
data.recordLog = function (text, roomName, groupInterval = 180) {
  roomName = roomName ? roomName.toUpperCase() : undefined;
  if (!Memory._log) {
    Memory._log = [];
  }

  const roomURL = `https://screeps.com/${SHARD === 'shardSeason' ? 'season' : 'a'}/#!/room/${SHARD}/${roomName}`;
  const roomHyperLink = `<a href="${roomURL}" target="_blank">${roomName}</a>`;

  const roomNameWithColor = `<span style = "color: yellow">[${roomHyperLink}]</span>`;

  const koreaDateText = getKoreaDateText();
  const koreaDateTextWithColor = `<span style = "color: magenta">[${koreaDateText}]</span>`;

  const tickWithColor = `<span style = "color: lime">[tick: ${Game.time}]</span>`;

  const contentWithColor = `<span style = "color: cyan">${text}</span>`;
  const URL = roomName
    ? `https://screeps.com/${SHARD === 'shardSeason' ? 'season' : 'a'}/#!/history/${SHARD}/${roomName}?t=${Game.time - 5}`
    : undefined;
  const hyperLink = URL ? `<a href="${URL}" target="_blank">[Link]</a>` : undefined;

  const logContents = `${koreaDateTextWithColor} ${tickWithColor} ${roomNameWithColor} ${contentWithColor} ${hyperLink || ``}`;
  const notifyContents = `[${koreaDateText}] [tick: ${Game.time}] [${roomName}] ${text}`;

  Memory._log.push(logContents);
  Game.notify(notifyContents, groupInterval);
  console.log(notifyContents);
  while (Memory._log.length > 90) {
    Memory._log.shift();
  }
};

function getKoreaDateText() {
  const now = new Date();
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const koreaNow = utcNow + 9 * 60 * 60 * 1000;
  const koreaDate = new Date(koreaNow);

  const month = toTwoDigits(koreaDate.getMonth() + 1);
  const date = toTwoDigits(koreaDate.getDate());
  const minutes = toTwoDigits(koreaDate.getMinutes());

  return `${koreaDate.getFullYear()}.${month}.${date}. ${koreaDate.getHours()}:${minutes}`;
}

data.getErrLog = function () {
  Memory._errLog = Memory._errLog || [];
  return Memory._errLog;
};

data.recordError = function (err, note) {
  const errLog = this.getErrLog();
  const stack = err.stack;
  const time = Game.time;

  const log = { time, stack, note };

  console.log(`<span style = "color: red">[tick: ${log.time}] [${note}]</span> \n ${log.stack}`);

  if (errLog.some((log) => log.stack === stack)) {
    return;
  }

  const koreaDateText = getKoreaDateText();
  log.koreaTime = koreaDateText;

  errLog.push(log);

  while (errLog.length > 10) {
    errLog.shift();
  }
};

data.logErr = function () {
  const errLog = this.getErrLog();

  for (const log of errLog) {
    console.log(
      `<span style = "color: red">[tick: ${log.time}] [${log.koreaTime}] [${log.note}]</span> \n ${log.stack}`
    );
  }
};

function toTwoDigits(string) {
  string = string.toString();
  while (string.length < 2) {
    string = '0' + string;
  }
  return string;
}

global.log = function () {
  if (!Memory._log) {
    return 'no log until now';
  }
  let num = 1;
  for (const text of Memory._log) {
    console.log(`#${toTwoDigits(num)} ${text}`);
    num++;
  }
  return 'end.';
};

module.exports = {
  toTwoDigits,
};
