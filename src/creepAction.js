const { config } = require("./config")
const { runAway } = require("./room_manager_remote")
const { getRoomMemory } = require("./util")

const SOURCE_KEEPER_RANGE_TO_START_FLEE = 7

const SOURCE_KEEPER_RANGE_TO_FLEE = 6

const KEEPER_LAIR_RANGE_TO_START_FLEE = 9

const KEEPER_LAIR_RANGE_TO_FLEE = 8

function miner(creep) {
    // 캐러 갈 곳
    const source = Game.getObjectById(creep.memory.sourceId)
    const container = source.container
    const link = source.link

    if (container && !creep.pos.isEqualTo(container.pos)) {
        if (!container.pos.creep || container.pos.creep.memory.role !== creep.memory.role) {
            return creep.moveMy(source.container)
        }
    }

    if (creep.pos.getRangeTo(source) > 1) {
        const targetPos = source.pos.getAtRange(1).find(pos => pos.walkable && (!pos.creep || (pos.creep.my && pos.creep.memory.role !== creep.memory.role)))
        if (!targetPos) {
            creep.moveMy({ pos: source.pos, range: 3 })
            return
        }
        return creep.moveMy({ pos: targetPos, range: 0 })
    }

    creep.harvest(source)

    if (!creep.store.getCapacity()) {
        return
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) && container && container.hits < 248000) {
        return creep.repair(container)
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 40) {
        return creep.transfer(link, RESOURCE_ENERGY)
    }

    if (container && container.store[RESOURCE_ENERGY]) {
        return creep.withdraw(container, RESOURCE_ENERGY)
    }
}

function wallMaker(creep) { //스폰을 대입하는 함수 (이름 아님)
    const room = creep.room

    if (creep.ticksToLive < 20) {
        creep.getRecycled()
        return
    }

    if (creep.memory.working && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        creep.memory.working = false
    } else if (!creep.memory.working && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        creep.memory.working = true;
    }

    if (!creep.memory.working) {
        delete creep.memory.targetId
        if (room.storage) {
            if (creep.pos.getRangeTo(room.storage) > 1) {
                creep.moveMy({ pos: room.storage.pos, range: 1 })
                return
            }
            creep.withdraw(room.storage, RESOURCE_ENERGY)
        } else {
            creep.heap.deliveryCallTime = Game.time
        }
        return
    }

    if (!room.storage && Math.random() < 0.05) {
        delete creep.memory.targetId
    }

    let target = Game.getObjectById(creep.memory.targetId)
    if (target) {
        creep.setWorkingInfo(target.pos, 3)
    }

    if (!target || !target.structureType || target.structureType !== 'rampart') {
        target = creep.room.weakestRampart
        if (target) {
            creep.memory.targetId = target.id
        }
    }

    if (creep.pos.getRangeTo(target) > 2) {
        creep.moveMy({ pos: target.pos, range: 2 })
        return
    }

    target = getMinObject(creep.pos.findInRange(creep.room.structures.rampart, 3), rampart => rampart.hits)
    creep.repair(target)
}

function extractor(creep) { //스폰을 대입하는 함수 (이름 아님)
    const terminal = Game.getObjectById(creep.memory.terminal)
    const mineral = Game.getObjectById(creep.memory.mineral)
    const extractor = creep.room.structures.extractor[0]
    if (!extractor) {
        this.getRecycled()
        return
    }
    const container = extractor.pos.findInRange(creep.room.structures.container, 1)[0]
    if (!terminal || !container) {
        data.recordLog(`FAIL: ${creep.name} can't harvest mineral`, creep.room.name)
        return
    }

    //행동

    if (!creep.pos.isEqualTo(container.pos)) {
        return creep.moveMy(container.pos)
    }

    if (extractor.cooldown === 0) {
        return creep.harvest(mineral)
    }
}

function colonyDefender(creep) {

    if (creep.memory.boosted === false && !Overlord.remotes.includes(creep.memory.colony)) {
        delete creep.memory.boosted
        delete creep.memory.wait
    }

    creep.activeHeal()

    creep.harasserRangedAttack()

    if (!creep.memory.flee && (creep.hits / creep.hitsMax) <= 0.7) {
        creep.memory.flee = true
    } else if (creep.memory.flee && (creep.hits / creep.hitsMax) === 1) {
        creep.memory.flee = false
    }

    const hostileCreeps = creep.room.findHostileCreeps()
    const killerCreeps = hostileCreeps.filter(creep => creep.checkBodyParts(['attack', 'ranged_attack', 'heal']))

    if (killerCreeps.length > 0) {
        // remember when was the last time that enemy combatant detected
        creep.heap.enemyLastDetectionTick = Game.time

        if (creep.handleCombatants(killerCreeps) !== ERR_NO_PATH) {
            return
        }
    }

    if (creep.room.name !== creep.memory.colony) {
        if (creep.memory.waitForTroops) {
            return
        }

        if (creep.memory.flee) {
            const enemyCombatants = creep.room.getEnemyCombatants()
            for (const enemy of enemyCombatants) {
                if (creep.pos.getRangeTo(enemy.pos) < 10) {
                    creep.say('😨', true)
                    creep.fleeFrom(enemy, 15, 2)
                    return
                }
            }
            const center = new RoomPosition(25, 25, creep.room.name)
            if (creep.pos.getRangeTo(center) > 20) {
                creep.moveMy({ pos: center, range: 20 })
            }
            return
        }

        creep.moveToRoom(creep.memory.colony, 2)
        return
    }

    const closestHostileCreep = creep.pos.findClosestByPath(hostileCreeps)

    if (closestHostileCreep) {
        creep.heap.enemyLastDetectionTick = Game.time
        const range = creep.pos.getRangeTo(closestHostileCreep)
        if (range > 1) {
            creep.moveMy({ pos: closestHostileCreep.pos, range: 1 }, { staySafe: false, ignoreMap: 1 })
        }
        return
    }

    if (creep.heap.enemyLastDetectionTick !== undefined && Game.time < creep.heap.enemyLastDetectionTick + 5) {
        return
    }

    const wounded = creep.room.find(FIND_MY_CREEPS).filter(creep => creep.hitsMax - creep.hits > 0)
    if (wounded.length) {
        const target = creep.pos.findClosestByRange(wounded)
        if (creep.pos.getRangeTo(target) > 1) {
            creep.moveMy({ pos: target.pos, range: 1 }, { staySafe: false, ignoreMap: 1 })
        }
        creep.heal(target)
        return
    }

    if (creep.room.isMy) {
        creep.setWorkingInfo(creep.room.controller.pos, 5)
        creep.moveMy({ pos: creep.room.controller.pos, range: 5 }, { staySafe: false, ignoreMap: 1 })
        return
    }

    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES).filter(constructionSite => !constructionSite.my && !constructionSite.pos.isWall && constructionSite.progress > 0)
    const closestConstructionSite = creep.pos.findClosestByPath(constructionSites)
    if (closestConstructionSite) {
        if (closestConstructionSite.pos.isRampart) {
            return creep.moveMy({ pos: closestConstructionSite.pos, range: 1 })
        }
        return creep.moveMy(closestConstructionSite)
    }

    const intel = Overlord.getIntel(creep.room.name)
    const isEnemyRemote = (intel[scoutKeys.reservationOwner] && !intel[scoutKeys.isAllyRemote] && !Overlord.remotes.includes(creep.room.name))

    const structuresToWreck = isEnemyRemote
        ? creep.room.find(FIND_STRUCTURES)
        : creep.room.find(FIND_HOSTILE_STRUCTURES)

    const hostileStructure = creep.pos.findClosestByPath(structuresToWreck.filter(structure => {
        const structureType = structure.structureType
        if (structureType === 'controller') {
            return false
        }
        if (structureType === 'powerBank') {
            return false
        }
        return true
    }))
    if (hostileStructure) {
        if (creep.pos.getRangeTo(hostileStructure) > 1) {
            creep.moveMy({ pos: hostileStructure.pos, range: 1 }, { staySafe: false, ignoreMap: 1 })
            return
        }
        creep.rangedAttack(hostileStructure)
        return
    }

    if (creep.room.constructionSites.length > 0) {
        const constructionSite = creep.room.constructionSites[0]
        creep.moveMy({ pos: constructionSite.pos, range: 5 })
        creep.setWorkingInfo(constructionSite.pos, 5)
        return
    }

    if (creep.pos.x < 3 || creep.pos.x > 46 || creep.pos.y < 3 || creep.pos.y > 46) {
        const center = new RoomPosition(25, 25, creep.memory.colony)
        creep.setWorkingInfo(center, 20)
        creep.moveMy({ pos: center, range: 20 }, { staySafe: false, ignoreMap: 1 })
    }
}

function claimer(creep) { //스폰을 대입하는 함수 (이름 아님)
    const hostileCreeps = creep.room.getEnemyCombatants()

    if (creep.pos.findInRange(hostileCreeps, 5).length > 0) {
        creep.fleeFrom(hostileCreeps, 15)
        return
    }

    if (creep.room.name !== creep.memory.targetRoom) {

        const flag = creep.room.find(FIND_FLAGS)[0]
        if (flag) {
            if (creep.pos.isEqualTo(flag.pos)) {
                return flag.remove()
            }
            return creep.moveMy(flag.pos)
        }

        const controller = Game.rooms[creep.memory.targetRoom] ? Game.rooms[creep.memory.targetRoom].controller : false
        if (controller) {
            return creep.moveMy({ pos: controller.pos, range: 1 })
        }
        creep.moveToRoom(creep.memory.targetRoom, 2)
        return
    }

    const controller = creep.room.controller

    if (!controller) {
        return
    }

    // approach
    if (creep.pos.getRangeTo(controller.pos) > 1) {
        return creep.moveMy({ pos: controller.pos, range: 1 });
    }

    // if reserved, attack controller
    if (controller.reservation && controller.reservation.username !== MY_NAME) {
        return creep.attackController(controller)
    }

    // if owned, attack controller
    if (controller.owner && controller.owner.username !== MY_NAME && !controller.upgradeBlocked) {
        return creep.attackController(controller)
    }

    // claim
    if (!controller.owner) {
        creep.claimController(controller)
        return
    }

    // sign
    if (!controller.sign || controller.sign.username !== MY_NAME) {
        creep.signController(controller, "A creep can do what he wants, but not want what he wants.")
    }
}

function pioneer(creep) {
    if (creep.room.name === creep.memory.targetRoom) {
        // 논리회로
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false
        } else if (!creep.memory.working && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.working = true
        }

        // 행동
        if (creep.memory.working) {
            const spawn = creep.room.structures.spawn[0]
            if (spawn && spawn.store[RESOURCE_ENERGY] < spawn.store.getCapacity(RESOURCE_ENERGY)) {
                return creep.giveEnergyTo(spawn.id)
            }

            if (!Game.getObjectById(creep.memory.targetId)) {
                if (creep.room.constructionSites.length) {
                    creep.memory.targetId = creep.room.constructionSites.sort((a, b) => { return BUILD_PRIORITY[a.structureType] - BUILD_PRIORITY[b.structureType] })[0].id
                } else {
                    creep.memory.targetId = false
                }
            }
            if (creep.room.controller.ticksToDowngrade > 1000 && creep.memory.targetId) {
                const workshop = Game.getObjectById(creep.memory.targetId)
                if (creep.build(workshop) === -9) {
                    return creep.moveMy({ pos: workshop.pos, range: 3 })
                }
            } else {
                if (creep.upgradeController(creep.room.controller) === -9) {
                    return creep.moveMy({ pos: creep.room.controller.pos, range: 3 })
                }
            }
        } else {
            const remainStructures = creep.room.find(FIND_HOSTILE_STRUCTURES).filter(structure => structure.store && structure.store[RESOURCE_ENERGY] > 100)
            remainStructures.push(...creep.room.find(FIND_RUINS).filter(ruin => ruin.store[RESOURCE_ENERGY] > 0))
            if (remainStructures.length) {
                creep.memory.withdrawFrom = creep.pos.findClosestByRange(remainStructures).id
                if (creep.withdraw(Game.getObjectById(creep.memory.withdrawFrom), RESOURCE_ENERGY) === -9) {
                    return creep.moveMy({ pos: Game.getObjectById(creep.memory.withdrawFrom).pos, range: 1 })
                }
            }
            const droppedEnergies = creep.room.find(FIND_DROPPED_RESOURCES).filter(resource => resource.resourceType === 'energy')
            const closestDroppedEnergy = creep.pos.findClosestByRange(droppedEnergies)
            if (creep.pos.getRangeTo(closestDroppedEnergy) <= 3) {
                if (creep.pos.getRangeTo(closestDroppedEnergy) > 1) {
                    return creep.moveMy({ pos: closestDroppedEnergy.pos, range: 1 })
                }
                return creep.pickup(closestDroppedEnergy)
            }
            const sources = creep.room.sources
            if (sources.length === 0) {
                return
            }
            const source = sources[(creep.memory.number || 0) % sources.length]
            if (creep.pos.getRangeTo(source) > 1) {
                return creep.moveMy({ pos: source.pos, range: 1 })
            }
            creep.setWorkingInfo(source.pos, 1)
            return creep.harvest(source)
        }
    } else {
        if (creep.room.name !== creep.memory.targetRoom && creep.room.find(FIND_FLAGS).length) {
            const flag = creep.room.find(FIND_FLAGS)[0]
            if (creep.pos.isEqualTo(flag.pos)) {
                return flag.remove()
            }
            return creep.moveMy(flag.pos)
        }
        const target = new RoomPosition(25, 25, creep.memory.targetRoom)
        return creep.moveMy({ pos: target, range: 20 });
    }
}

function guard(creep) {
    if (creep.memory.targetRoomName) {
        return
    }
    if (config.harass && !creep.memory.harass && creep.ticksToLive < 500) {
        creep.memory.harass = true
    }
    if (creep.memory.harass) {
        if (creep.harass() === OK) {
            return
        } else {
            creep.memory.harass = false
        }
    }
    creep.healWounded()
    creep.harasserRangedAttack()

    if (creep.room.name === creep.memory.base) {
        const enemyCombatants = creep.room.getEnemyCombatants()
        if (enemyCombatants.length > 0) {
            creep.handleCombatants(enemyCombatants)
            return
        }
    }

    creep.moveToRoom(creep.memory.base, 2)
}

function researcher(creep) {
    creep.delivery()
}

function reserver(creep) {
    const targetRoomName = creep.memory.targetRoomName

    if (creep.spawning) {
        return
    }

    if (getRoomMemory(targetRoomName).isCombatant) {
        runAway(creep, creep.memory.base)
        return
    }

    if (creep.memory.getRecycled === true) {
        if (creep.room.name === creep.memory.base) {
            creep.getRecycled()
            return
        }
        const room = Game.rooms[creep.memory.base]
        if (!room) {
            creep.suicide()
            return
        }
        creep.moveToRoom(creep.memory.base)
        return
    }

    const hostileCreeps = creep.room.getEnemyCombatants()

    if (creep.pos.findInRange(hostileCreeps, 5).length > 0) {
        creep.fleeFrom(hostileCreeps, 15)
        return
    }

    const targetRoom = Game.rooms[targetRoomName]

    if (!targetRoom) {
        creep.moveToRoom(targetRoomName)
        return
    }

    const controller = targetRoom ? targetRoom.controller : undefined

    if (creep.pos.getRangeTo(controller.pos) > 1) {
        const targetPos = controller.pos.getAtRange(1).find(pos => pos.walkable && (!pos.creep || (pos.creep.my && pos.creep.memory.role !== creep.memory.role)))
        if (!targetPos) {
            if (creep.pos.getRangeTo(controller.pos) > 3) {
                creep.moveMy({ pos: controller.pos, range: 3 })
            }
            return
        }
        creep.moveMy({ pos: targetPos, range: 0 })
        return
    }

    if (!controller.sign || controller.sign.username !== creep.owner.username) {
        creep.signController(controller, "A creep can do what he wants, but not want what he wants.")
    }

    creep.setWorkingInfo(controller.pos, 1)

    // if reserved, attack controller
    if (controller.reservation && controller.reservation.username !== MY_NAME) {
        creep.attackController(controller)
        return
    }

    creep.reserveController(controller)
    return
}

function remoteMiner(creep) {
    targetRoomName = creep.memory.targetRoomName

    if (creep.spawning) {
        return
    }

    if (creep.memory.getRecycled === true) {
        if (creep.room.name === creep.memory.base) {
            creep.getRecycled()
            return
        }
        const room = Game.rooms[creep.memory.base]
        if (!room) {
            creep.suicide()
            return
        }
        creep.moveToRoom(creep.memory.base)
        return
    }

    if (getRoomMemory(targetRoomName).isCombatant) {
        runAway(creep, creep.memory.base)
        return
    }

    const hostileCreeps = creep.room.getEnemyCombatants()

    const roomType = getRoomType(creep.room.name)

    if (roomType === 'sourceKeeper') {
        if (creep.pos.findInRange(hostileCreeps, SOURCE_KEEPER_RANGE_TO_START_FLEE).length > 0) {
            creep.fleeFrom(hostileCreeps, SOURCE_KEEPER_RANGE_TO_FLEE)
            return
        }

        const keeperLairs = creep.room.find(FIND_HOSTILE_STRUCTURES).filter(structure => {
            if (structure.structureType !== STRUCTURE_KEEPER_LAIR) {
                return false
            }

            if (structure.ticksToSpawn > 15) {
                return false
            }

            return true
        })

        if (creep.pos.findInRange(keeperLairs, KEEPER_LAIR_RANGE_TO_START_FLEE).length > 0) {
            creep.fleeFrom(keeperLairs, KEEPER_LAIR_RANGE_TO_FLEE)
            return
        }

    } else {
        if (hostileCreeps.length > 0) {
            runAway(creep, creep.memory.base)
            return
        }
    }

    const targetRoom = Game.rooms[targetRoomName]

    if (!targetRoom) {
        creep.moveToRoom(targetRoomName)
        return
    }

    const source = Game.getObjectById(creep.memory.sourceId)
    const container = Game.getObjectById(creep.memory.containerId) || targetRoom.structures.container.find(structure => structure.pos.isNearTo(source))
    const isOtherCreep = container && container.pos.creep && container.pos.creep.memory && container.pos.creep.memory.role === creep.memory.role

    const target = (container && !isOtherCreep) ? container : source

    const range = (container && !isOtherCreep) ? 0 : 1

    if (creep.pos.getRangeTo(target) > range) {
        creep.moveMy({ pos: target.pos, range })
        return
    }

    creep.setWorkingInfo(target.pos, range)

    const harvestPower = creep.getActiveBodyparts(WORK) * HARVEST_POWER

    if (source instanceof Source) {
        if (container && (container.store.getUsedCapacity() >= (CONTAINER_CAPACITY - harvestPower))) {
            if (container.hits < 245000) {
                if (creep.store[RESOURCE_ENERGY] > 0) {
                    creep.repair(container)
                    return
                } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
                    creep.harvest(source)
                    return
                }
            }
            if (Math.ceil(source.energy / harvestPower) < (source.ticksToRegeneration || 0)) {
                return
            }
        }
        creep.harvest(source)
    } else if (source instanceof Mineral) {
        creep.harvest(source)
    }

    if (creep.store[RESOURCE_ENERGY] > 0 && container && container.hits < 150000) {
        creep.repair(container)
    }
}

function sourceKeeperHandler(creep) {
    const roomName = creep.memory.targetRoomName

    if (creep.spawning) {
        return
    }

    if (creep.hits < creep.hitsMax) {
        creep.heal(creep)
    }

    if (getRoomMemory(targetRoomName).isCombatant) {
        runAway(creep, creep.memory.base)
        return
    }

    const room = Game.rooms[roomName]

    if (!room || creep.room.name !== roomName) {
        creep.moveToRoom(roomName, 2)
        return
    }

    const sourceKeepers = room.find(FIND_HOSTILE_CREEPS).filter(creep => creep.owner.username === 'Source Keeper')

    if (sourceKeepers.length === 0) {
        const nextSourceKeeperLair = getNextSourceKeeperLair(creep)
        if (nextSourceKeeperLair) {
            creep.moveMy({ pos: nextSourceKeeperLair.pos, range: 1 })
        }
        return
    } else {
        delete creep.heap.nextSourceKeeperLair
    }

    const closeSourceKeeper = sourceKeepers.find(sourceKeeper => creep.pos.getRangeTo(sourceKeeper) <= 1)
    if (closeSourceKeeper) {
        creep.move(creep.pos.getDirectionTo(closeSourceKeeper))
        creep.attack(closeSourceKeeper)
        return
    }

    const goals = sourceKeepers.map(sourceKeeper => {
        return { pos: sourceKeeper.pos, range: 1 }
    })
    creep.moveMy(goals)
    return

}

function getNextSourceKeeperLair(creep) {
    if (!creep.heap.nextSourceKeeperLair) {
        return creep.heap.nextSourceKeeperLair = findNextSourceKeeperLair(creep.room.name)
    }
    return creep.heap.nextSourceKeeperLair
}

function findNextSourceKeeperLair(roomName) {
    const room = Game.rooms[roomName]

    if (!room) {
        return undefined
    }

    const structures = room.find(FIND_HOSTILE_STRUCTURES)

    let result = undefined
    let ticksToSpawnMin = Infinity

    for (const structure of structures) {
        if (structure.structureType !== STRUCTURE_KEEPER_LAIR) {
            continue
        }

        const ticksToSpawn = structure.ticksToSpawn
        if (ticksToSpawn === undefined) {
            continue
        }
        if (ticksToSpawn < ticksToSpawnMin) {
            result = structure
            ticksToSpawnMin = ticksToSpawn
        }
    }

    return result
}

module.exports = { miner, extractor, claimer, pioneer, colonyDefender, wallMaker, researcher, guard, reserver, remoteMiner, sourceKeeperHandler }