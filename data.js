global.data = {}
data.creeps = {}
data.time = new Date().getTime()
data.tick = Game.time
data.terminalOrder = 0
data.enoughCPU = true
data.okCPU = true
data.cpuEmergency = false
data.isEnoughCredit = false
data.info = true

data.recordLog = function (text, roomName, groupInterval = 180) {
  roomName = roomName ? roomName.toUpperCase() : undefined
  if (!Memory._log) {
    Memory._log = []
  }

  const roomNameText = roomName === undefined ? 'GLOBAL' : toRoomNameForm(roomName)
  const roomNameWithColor = `<span style = "color: yellow">[${roomName}]</span>`

  const now = new Date()
  const utcNow = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
  const koreaNow = utcNow + (9 * 60 * 60 * 1000)
  const koreaDate = new Date(koreaNow)

  const month = toTwoDigits(koreaDate.getMonth() + 1)
  const date = toTwoDigits(koreaDate.getDate())
  const minutes = toTwoDigits(koreaDate.getMinutes())

  const koreaDateText = `${koreaDate.getFullYear()}.${month}.${date}. ${koreaDate.getHours()}:${minutes}`
  const koreaDateTextWithColor = `<span style = "color: magenta">[${koreaDateText}]</span>`

  const tickWithColor = `<span style = "color: lime">[tick: ${Game.time}]</span>`

  const contentWithColor = `<span style = "color: cyan">${text}</span>`
  const URL = roomName ? `https://screeps.com/a/#!/history/${SHARD}/${roomName}?t=${Game.time - 5}` : undefined
  const hyperLink = URL ? `<a href="${URL}" target="_blank">[Link]</a>` : undefined

  const logContents = `${koreaDateTextWithColor} ${tickWithColor} ${roomNameWithColor} ${contentWithColor} ${hyperLink || ``}`
  const notifyContents = `[${koreaDateText}] [tick: ${Game.time}] [${roomNameText}] ${text}`

  Memory._log.push(logContents)
  Game.notify(notifyContents, groupInterval)

  if (Memory._log.length > 100) {
    Memory._log.splice(0, Memory._log.length - 50)
  }

}

function toTwoDigits(string) {
  string = string.toString()
  while (string.length < 2) {
    string = '0' + string
  }
  return string
}

function toRoomNameForm(string) {
  string = string.toString()
  while (string.length < 6) {
    string = ' ' + string
  }
  return string
}

global.log = function () {
  if (!Memory._log) {
    return 'no log until now'
  }
  let num = 1
  for (const text of Memory._log) {
    console.log(`#${toTwoDigits(num)} ${text}`)
    num++
  }
  return 'end.'
}