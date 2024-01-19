const profiler = require('screeps-profiler');
const { ResourceColors } = require('./roomVisual_prototype');

const OPACITY = 0.5

Object.defineProperties(Room.prototype, {
    progressHour: {
        get() {
            return (new Date().getTime() - this.memory.info[0].time) / 1000 / 60 / 60
        }
    },
    progressPerHour: {
        get() {
            if (this.controller.level === 8) {
                return undefined
            }
            const progress = this.controller.totalProgress - this.memory.info[0].progress
            const time = this.progressHour //시간으로 계산
            return progress / time
        }
    },
    hoursToNextRCL: {
        get() {
            return (this.controller.progressTotal - this.controller.progress) / this.progressPerHour
        }
    }
})

Room.prototype.getControlPointsPerTick = function () {
    if (this.controller.level === 8) {
        return undefined
    }
    if (!this.memory.info) {
        return undefined
    }
    if (!this.memory.info[0]) {
        return undefined
    }
    const progressBefore = this.memory.info[0].progress || 0
    const tickBefore = this.memory.info[0].tick || 0
    const progress = this.controller.totalProgress - progressBefore
    const tick = Game.time - tickBefore
    return progress / tick
}

global.X_ENTIRE = {
    start: 0,
    end: 0
}

// item prototype
function VisualItem(name, length, text) {
    // textFunction : (Room) => {text, option}
    this.name = name
    this.start = X_ENTIRE.end
    this.end = X_ENTIRE.end = X_ENTIRE.end + length
    this.mid = (this.start + this.end) / 2
    this.text = text
}

// 방 이름
const roomName = new VisualItem('Name', 5, (room) => {
    let emoji = undefined
    let color = undefined
    if (room.memory.militaryThreat) {
        emoji = '⚠️'
        color = 'magenta'
    } else if (room.heap.constructing) {
        emoji = '🧱'
        color = 'yellow'
    } else {
        emoji = '🔼'
        color = 'cyan'
    }
    if (room.memory.defenseNuke) {
        emoji = '☢️' + emoji
    }
    const content = `${emoji}${room.name}(${room.mineral.mineralType})`
    const option = { color }
    return { content, option }
})


// RCL
const rcl = new VisualItem('RCL', 3.5, (room) => {
    if (room.controller.level === 8) {
        const content = '8'
        const option = { color: 'lime' }
        return { content, option }
    }
    const content = `${room.controller.level}(${Math.round(100 * room.controller.progress / room.controller.progressTotal)}%)`

    const hue = 120 * room.controller.level / 8
    const color = `hsl(${hue},100%,60%)`

    const option = { color }
    return { content, option }
})

// Spawn
const spawnCapacity = new VisualItem('Spawn', 3, (room) => {
    const spawnCapacityRatio = room.getSpawnCapacityRatio()
    const content = `${Math.round(100 * spawnCapacityRatio)}%`

    const hue = 120 * Math.min(1, 2 - 2 * spawnCapacityRatio)
    const color = `hsl(${hue},100%,60%)`

    const option = { color }
    return { content, option }
})

// Upgrade Rate
const control = new VisualItem('Control', 3.5, (room) => {
    if (room.controller.level === 8) {
        const content = room.heap.upgrading ? '15e/t' : '-'
        const option = { color: 'lime' }
        return { content, option }
    }
    const controlPointsPerTick = room.getControlPointsPerTick()
    const content = `${Math.floor(10 * controlPointsPerTick) / 10}e/t`
    const option = { color: controlPointsPerTick > 14 ? 'lime' : controlPointsPerTick > 8 ? 'yellow' : 'magenta' }
    return { content, option }
})

// next RCL
const nextRCL = new VisualItem('next RCL', 4, (room) => {
    const day = Math.floor(room.hoursToNextRCL / 24)
    const hour = Math.floor(10 * (room.hoursToNextRCL % 24)) / 10
    const leftTime = day === Infinity ? "-" : day > 0 ? `${day}d ${hour}h` : `${hour}h`
    const content = room.controller.level === 8 ? '-' : leftTime
    const option = { color: 'cyan' }
    return { content, option }
})

// Storage
const storedEnergy = new VisualItem('Storage', 4.5, (room) => {
    const energyStored = room.storage ? room.storage.store[RESOURCE_ENERGY] : 0
    const content = energyStored ? `${Math.floor(energyStored / 1000)}K(${room.energyLevel})` : '-'

    const hue = 120 * Math.max(0, room.energyLevel - 50) / 150
    const color = `hsl(${hue},100%,60%)`

    const option = { color }
    return { content, option }
})

// Remote
const remoteIncome = new VisualItem('Remote', 4, (room) => {
    const num = (() => {
        if (!room.memory.activeRemotes) {
            return 0
        }
        let result = 0
        for (const remoteName of room.memory.activeRemotes) {
            remoteStatus = room.getRemoteStatus(remoteName)
            const numSource =
                remoteStatus && remoteStatus.infraPlan
                    ? Object.keys(remoteStatus.infraPlan).length
                    : 0
            result += numSource
        }
        return result
    })()

    room.memory.numRemoteSource = num

    if (num === 0) {
        const content = '-'
        const option = { color: `hsl(0,100%,60%)` }
        return { content, option }
    }

    let income = 0
    for (const remoteName of room.memory.activeRemotes) {
        const status = room.memory.remotes[remoteName]
        if (!status) {
            continue
        }

        const visualPos = new RoomPosition(25, 5, remoteName)

        if (status.construction === 'proceed') {
            Game.map.visual.text(`🏗️`, visualPos, { align: 'right', fontSize: 5, backgroundColor: '#000000', opacity: 1 })
            new RoomVisual(remoteName).text(`12`, 25, 45)
            continue
        }

        const numSource = room.getRemoteNumSource(remoteName)
        const remoteIncome = room.getRemoteIdealNetIncomePerTick(remoteName)

        if (isNaN(remoteIncome)) {
            continue
        }

        const color = remoteIncome / numSource > 5 ? '#000000' : '#740001'
        Game.map.visual.text(`📊${remoteIncome.toFixed(1)}e/t`, visualPos, { align: 'right', fontSize: 5, backgroundColor: color, opacity: 1 })

        income += remoteIncome
    }
    room.heap.remoteIncome = income
    const incomePerSource = Math.floor(10 * (income / num)) / 10
    const content = `${incomePerSource}e/t * ${num}`

    const hue = 120 * Math.max(0, incomePerSource - 2) / 5
    const color = `hsl(${hue},100%,60%)`

    const option = { color }
    return { content, option }
})

// Lab
const lab = new VisualItem('Lab', 3, (room) => {
    if (room.memory.boostState) {
        const content = room.memory.boostState
        const option = { color: 'lime' }
        return { content, option }
    } else {
        const content = `${room.memory.labTarget ? room.memory.labTarget : '-'}`
        const option = { color: room.memory.labTarget ? 'lime' : room.memory.labs ? 'yellow' : 'magenta' }
        return { content, option }
    }
})

//power
const powerProcess = new VisualItem('Power', 3, (room) => {
    const content = room.heap.powerProcessing ? 'active' : '-'
    const option = { color: 'lime' }
    return { content, option }
})

// Rampart
const rampart = new VisualItem('Rampart', 4, (room) => {
    const value = Math.round(room.structures.minProtectionHits / 10000) / 100
    const content = `${value}M`

    const hue = 120 * value / 50
    const color = `hsl(${hue},100%,60%)`

    const option = { color }
    return { content, option }
})

// 표시할 정보 목록
const items = [
    roomName,
    rcl,
    spawnCapacity,
    control,
    nextRCL,
    storedEnergy,
    remoteIncome,
    lab,
    powerProcess,
    rampart
]

Overlord.visualizeRoomInfo = function () {
    const startPos = { x: -0.5, y: 0.5 }
    const numMyRoom = this.myRooms.length

    new RoomVisual().rect(startPos.x + X_ENTIRE.start, startPos.y - 1, X_ENTIRE.end + 0.5, numMyRoom + 3, { fill: 'black', opacity: 0.3 }); // 틀 만들기

    const option = { color: 'cyan', strokeWidth: 0.2, align: 'left', opacity: OPACITY }
    new RoomVisual().text("Time " + Game.time, 0.5, startPos.y, option)
    new RoomVisual().text("CPU " + Math.floor(10 * Game.cpu.getUsed()) / 10, 6, startPos.y, option)
    new RoomVisual().text("Bucket " + Game.cpu.bucket, 10, startPos.y, option);
    new RoomVisual().text(`Room: ${numMyRoom}`, 15, startPos.y, option)
    new RoomVisual().text(`Remote: ${Overlord.remotes.length}(rooms)`, 18.5, startPos.y, option)
    new RoomVisual().text(`Creep: ${Object.keys(Game.creeps).length}`, 26, startPos.y, option)

    // 각 방마다 표시
    for (let i = -1; i < numMyRoom; i++) {
        const room = i >= 0 ? this.myRooms[i] : undefined
        // 각 item마다 표시
        for (const item of items) {
            // 구분선 삽입
            new RoomVisual().text('|', startPos.x + item.end, startPos.y + i + 2, { color: 'cyan', opacity: OPACITY })
            // 처음에는 item 이름
            if (i === -1) {
                new RoomVisual().text(item.name, startPos.x + item.mid, startPos.y + i + 2, { color: 'cyan', opacity: OPACITY })
                continue
            }
            // 그다음부터는 내용
            const text = item.text(room)
            const option = text.option
            option.opacity = OPACITY
            new new RoomVisual().text(text.content, startPos.x + item.mid, startPos.y + i + 2, text.option)
        }
    }

    visualizeResources(numMyRoom)
    visualizePossibleSquad(numMyRoom)
    visualizeTasks()
}

function visualizeResources(numMyRoom) {
    const stats = Memory.stats
    if (!stats) {
        return
    }
    const resources = Memory.stats.resources
    if (!resources) {
        return
    }

    const resourcesByTier = {
        0: BASIC_MINERALS,
        1: Object.keys(TIER1_COMPOUNDS),
        2: Object.keys(TIER2_COMPOUNDS),
        3: Object.keys(TIER3_COMPOUNDS),
    }
    const length = Math.max(...Object.values(resourcesByTier).map(array => array.length))

    const topLeftCorner = { x: -0.5, y: numMyRoom + 3 }

    new RoomVisual().rect(topLeftCorner.x + X_ENTIRE.start, topLeftCorner.y, X_ENTIRE.end + 0.5, length + 2, { fill: 'black', opacity: 0.3 }); // 틀 만들기

    for (let i = 0; i <= 3; i++) {
        const x = topLeftCorner.x + 1 + (5 + 0.3 * i) * i
        new RoomVisual().text(`|`, x - 0.5, topLeftCorner.y + 1, { color: 'cyan', align: 'left' })
        new RoomVisual().text(`T${i} Resources`, x, topLeftCorner.y + 1, { color: 'cyan', align: 'left', opacity: OPACITY })
        const resourceTypes = resourcesByTier[i]
        for (let j = 0; j < length; j++) {
            const y = topLeftCorner.y + 2 + j
            new RoomVisual().text(`|`, x - 0.5, y, { color: 'cyan', align: 'left' })

            const resourceType = resourceTypes[j]

            if (!resourceType) {
                continue
            }

            const amount = resources[resourceType] || 0


            new RoomVisual().text(`${resourceType}: ${amount.toLocaleString()}`, x, y, { color: ResourceColors[resourceType][0], align: 'left', opacity: OPACITY })
        }
    }
}

function visualizePossibleSquad(numMyRoom) {
    const middleMiddleCorner = { x: 26, y: numMyRoom + 4 }
    const numAvailableBlinkyQuad = Overlord.getNumAvailableBlinkyQuad()
    new RoomVisual().text(`|`, middleMiddleCorner.x - 0.5, middleMiddleCorner.y, { color: 'cyan', align: 'left' })
    new RoomVisual().text(`Quad Blinky Possible`, middleMiddleCorner.x, middleMiddleCorner.y, { color: 'cyan', align: 'left', opacity: OPACITY })
    let j = 1
    for (const i in numAvailableBlinkyQuad) {
        const x = middleMiddleCorner.x
        const y = middleMiddleCorner.y + j
        j++
        new RoomVisual().text(`|`, x - 0.5, y, { color: 'cyan', align: 'left' })
        new RoomVisual().text(`Quad Blinky ${i}: ${numAvailableBlinkyQuad[i]}`, x, y, { color: COLOR_NEON_GREEN, align: 'left', opacity: OPACITY })
    }

    const bottomMiddleCorner = { x: 26, y: middleMiddleCorner.y + 7 }
    const numAvailableDuo = Overlord.getNumAvailableDuo()

    new RoomVisual().text(`|`, bottomMiddleCorner.x - 0.5, bottomMiddleCorner.y, { color: 'cyan', align: 'left' })
    new RoomVisual().text(`Duo Possible`, bottomMiddleCorner.x, bottomMiddleCorner.y, { color: 'cyan', align: 'left', opacity: OPACITY })
    for (let i = 1; i <= 3; i++) {
        const x = bottomMiddleCorner.x
        const y = bottomMiddleCorner.y + i
        new RoomVisual().text(`|`, x - 0.5, y, { color: 'cyan', align: 'left' })
        new RoomVisual().text(`Ant T${i}: ${numAvailableDuo['ant'][i] || 0}`, x, y, { color: COLOR_NEON_RED, align: 'left', opacity: OPACITY })

        new RoomVisual().text(`|`, x + 4.5, y, { color: 'cyan', align: 'left' })
        new RoomVisual().text(`Worm T${i}: ${numAvailableDuo['worm'][i] || 0}`, x + 5, y, { color: COLOR_NEON_YELLOW, align: 'left', opacity: OPACITY })
    }
}

function visualizeTasks() {
    const topRightCorner = { x: 37.5, y: -0.5 }

    const tasks = Overlord.tasks
    let i = 1
    for (const category in tasks) {
        const requests = Object.values(tasks[category])
        if (requests.length === 0) {
            continue
        }
        new RoomVisual().text(`|`, topRightCorner.x, topRightCorner.y + i, { color: 'cyan', align: 'left' })
        new RoomVisual().text(category.toUpperCase(), topRightCorner.x + 0.5, topRightCorner.y + i, { color: 'cyan', align: 'left', opacity: OPACITY })
        i++
        for (const request of requests) {
            new RoomVisual().text(`|`, topRightCorner.x, topRightCorner.y + i, { color: 'cyan', align: 'left' })
            new RoomVisual().text(`${request.currentRoom || request.roomNameInCharge}➔${request.roomName}`, topRightCorner.x + 0.5, topRightCorner.y + i, { color: COLOR_NEON_YELLOW, align: 'left', opacity: OPACITY })
            switch (category) {
                case 'quad':
                    new RoomVisual().text(`(${request.status.toUpperCase()}) (${request.ticksToLive})`, 49.5, topRightCorner.y + i, { color: COLOR_NEON_YELLOW, align: 'right', opacity: OPACITY })
                    break
                case 'duo':
                    new RoomVisual().text(`(${request.status.toUpperCase()}) (${request.ticksToLive})`, 49.5, topRightCorner.y + i, { color: COLOR_NEON_YELLOW, align: 'right', opacity: OPACITY })
                    break
                case 'guard':
                    new RoomVisual().text(`(${request.status.toUpperCase()}) (${Game.time - request.time})`, 49.5, topRightCorner.y + i, { color: COLOR_NEON_YELLOW, align: 'right', opacity: OPACITY })
                    break
                case 'siege':
                    new RoomVisual().text(`(${request.endTime - Game.time})`, 49.5, topRightCorner.y + i, { color: COLOR_NEON_YELLOW, align: 'right', opacity: OPACITY })
                    break
                default:
            }
            i++
        }
        new RoomVisual().text(` ------------------------------`, topRightCorner.x + 0.5, topRightCorner.y + i, { color: 'cyan', align: 'left' })
        i++
    }

    const harassing = Game.harassing
    if (harassing) {
        new RoomVisual().text(`|`, topRightCorner.x, topRightCorner.y + i, { color: 'cyan', align: 'left' })
        new RoomVisual().text('HARASSING', topRightCorner.x + 0.5, topRightCorner.y + i, { color: 'cyan', align: 'left', opacity: OPACITY })
        i++
        for (const info of Object.values(harassing)) {
            new RoomVisual().text(`|`, topRightCorner.x, topRightCorner.y + i, { color: 'cyan', align: 'left' })
            new RoomVisual().text(`${info.current}➔${info.goal} (${info.ticksToLive})`, topRightCorner.x + 0.5, topRightCorner.y + i, { color: COLOR_NEON_YELLOW, align: 'left', opacity: OPACITY })
            i++
        }
    }

    new RoomVisual().rect(topRightCorner.x, topRightCorner.y, 50 - topRightCorner.x, i, { fill: 'black', opacity: 0.3 }); // 틀 만들기
}

profiler.registerObject(Overlord, 'Overlord')