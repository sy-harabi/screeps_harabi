const { config } = require('./config')
const { SOURCE_KEEPER_RANGE_TO_START_FLEE } = require('./room_manager_remote')
const { getLaborerModel } = require('./room_manager_spawn')
const { Util } = require('./util')

const MAX_WORK = 150
const COST_FOR_HUB_CENTER = 30

Object.defineProperties(Room.prototype, {
  GRCL: {
    get() {
      if (this._GRCL !== undefined) {
        return this._GRCL
      }
      if (!this.memory.GRCL || this.memory.GRCL < this.controller.level) {
        this.memory.GRCLhistory = this.memory.GRCLhistory || {}
        this.memory.GRCLhistory[this.controller.level] = Game.time
        data.recordLog(`RCL: ${this.name} got RCL ${this.controller.level}`, this.name)
      }
      this.memory.GRCL = Math.max(this.memory.GRCL || 0, this.controller.level)
      return (this._GRCL = this.memory.GRCL)
    },
  },
  sources: {
    get() {
      if (this._sources) {
        return this._sources
      }
      const thisRoom = this
      if (this.heap.sources) {
        this._sources = this.heap.sources.map((id) => {
          const source = Game.getObjectById(id)
          if (!source) {
            delete thisRoom.heap.sources
            return undefined
          }
          return source
        })
        return this._sources
      }
      this._sources = this.find(FIND_SOURCES)
      if (this.structures.spawn.length > 0) {
        this._sources.sort((a, b) => a.range.spawn - b.range.spawn)
      }
      this.heap.sources = this._sources.map((source) => source.id)
      return this._sources
    },
  },
  structures: {
    get() {
      if (this._structures) {
        return this._structures
      }
      this._structures = {}
      for (const structureType of STRUCTURE_TYPES) {
        this._structures[structureType] = []
      }
      this._structures.obstacles = []
      this._structures.damaged = []
      this._structures.minProtectionHits = 0
      for (const structure of this.find(FIND_STRUCTURES)) {
        if (
          structure.structureType !== STRUCTURE_RAMPART &&
          structure.structureType !== STRUCTURE_WALL &&
          structure.hits / structure.hitsMax < 0.8
        ) {
          this._structures.damaged.push(structure)
        }
        if (structure.structureType === STRUCTURE_RAMPART) {
          if (structure.hits < this._structures.minProtectionHits || this._structures.minProtectionHits === 0) {
            this._structures.minProtectionHits = structure.hits
          }
        }
        if (OBSTACLE_OBJECT_TYPES.includes(structure.structureType)) {
          this._structures.obstacles.push(structure)
        }
        this._structures[structure.structureType].push(structure)
      }
      return this._structures
    },
  },
  mineral: {
    get() {
      if (this._mineral) {
        return this._mineral
      }
      this._mineral = this.find(FIND_MINERALS)[0]
      return this._mineral
    },
  },
  creeps: {
    get() {
      if (this._creeps) {
        return this._creeps
      }
      const creeps = Overlord.classifyCreeps()
      this._creeps = creeps[this.name]
      return this._creeps
    },
  },
  laborer: {
    get() {
      if (this._laborer) {
        return this._laborer
      }
      this._laborer = {}
      this._laborer.numWork = 0
      this._laborer.numWorkEach = getLaborerModel(this.energyCapacityAvailable).numWork

      const upgraders = this.creeps.laborer.filter((creep) => {
        if (creep.memory.isBuilder) {
          return false
        }
        if ((creep.ticksToLive || 1500) < 3 * creep.body.length) {
          return false
        }
        return true
      })

      for (const laborer of upgraders) {
        this._laborer.numWork += laborer.body.filter((part) => part.type === WORK).length
      }
      return this._laborer
    },
  },
  energy: {
    get() {
      if (this._energy !== undefined) {
        return this._energy
      }

      if (this.storage) {
        return (this._energy = this.storage.store[RESOURCE_ENERGY])
      }

      return (this._energy = 0)
    },
  },
  energyLevel: {
    get() {
      if (this._energyLevel !== undefined) {
        return this._energyLevel
      }

      if (!this.isMy) {
        return undefined
      }

      return (this._energyLevel = this.getEnergyLevel())
    },
  },
  constructionSites: {
    get() {
      if (!this._constructionSites) {
        this._constructionSites = this.find(FIND_MY_CONSTRUCTION_SITES)
      }
      return this._constructionSites
    },
  },
  basicExitCostMatrix: {
    get() {
      if (this.heap._basicExitCostMatrix) {
        return this.heap._basicExitCostMatrix
      }

      const costs = new PathFinder.CostMatrix()

      for (const exit of this.find(FIND_EXIT)) {
        costs.set(exit.x, exit.y, 20)
      }

      return (this.heap._basicExitCostMatrix = costs)
    },
  },

  basicCostmatrix: {
    get() {
      if (Game.time > this.heap._basicCostmatrixTick + 10) {
        delete this.heap.basicCostmatrix
      }

      if (this.heap.basicCostmatrix) {
        return this.heap.basicCostmatrix
      }

      const costs = this.basicExitCostMatrix.clone()

      for (const structure of this.structures[STRUCTURE_ROAD]) {
        costs.set(structure.pos.x, structure.pos.y, 1)
      }

      for (const structure of this.structures.obstacles) {
        costs.set(structure.pos.x, structure.pos.y, 255)
      }

      if (this.isMy) {
        for (const source of this.find(FIND_SOURCES)) {
          const miners = [...this.creeps.miner, ...this.creeps.remoteMiner]
          const workingMiners = source.pos.findInRange(miners, 1)
          for (const miner of workingMiners) {
            const pos = miner.pos
            if (pos.terrain !== TERRAIN_MASK_WALL && costs.get(pos.x, pos.y) < 10) {
              costs.set(pos.x, pos.y, 10)
            }
          }
        }

        for (const cs of this.constructionSites) {
          if (cs.my && OBSTACLE_OBJECT_TYPES.includes(cs.structureType)) {
            costs.set(cs.pos.x, cs.pos.y, 255)
          } else {
            if (cs.pos.terrain !== TERRAIN_MASK_WALL && costs.get(cs.pos.x, cs.pos.y) < 20) {
              costs.set(cs.pos.x, cs.pos.y, 20)
            }
          }
        }

        const hubCenterPos = this.getHubCenterPos()
        if (hubCenterPos && costs.get(hubCenterPos.x, hubCenterPos.y) < COST_FOR_HUB_CENTER) {
          costs.set(hubCenterPos.x, hubCenterPos.y, COST_FOR_HUB_CENTER)
        }
      } else {
        const roomType = getRoomType(this.name)

        for (const rampart of this.structures.rampart) {
          if (!rampart.isPublic) {
            costs.set(rampart.pos.x, rampart.pos.y, 255)
          }
        }

        if (roomType === 'sourceKeeper') {
          for (const sourceKeeper of this.find(FIND_HOSTILE_CREEPS).filter(
            (creep) => creep.owner.username === 'Source Keeper'
          )) {
            for (const pos of sourceKeeper.pos.getInRange(SOURCE_KEEPER_RANGE_TO_START_FLEE)) {
              if (pos.terrain === TERRAIN_MASK_WALL) {
                continue
              }
              const weight = pos.terrain === TERRAIN_MASK_SWAMP ? 5 : 1
              if (pos.terrain !== TERRAIN_MASK_WALL && costs.get(pos.x, pos.y) < 10 * weight) {
                costs.set(pos.x, pos.y, 20 * weight)
              }
            }
          }
        } else {
          for (const portal of this.structures.portal) {
            costs.set(portal.pos.x, portal.pos.y, 254)
          }
        }
      }

      // for (let x = 0; x < 50; x++) {
      //   for (let y = 0; y < 50; y++) {
      //     this.visual.text(costs.get(x, y), x, y)
      //   }
      // }

      this.heap._basicCostmatrixTick = Game.time
      return (this.heap.basicCostmatrix = costs)
    },
  },
  costmatrixForBattle: {
    get() {
      const costs = new PathFinder.CostMatrix()
      for (const structure of this.structures[STRUCTURE_ROAD]) {
        costs.set(structure.pos.x, structure.pos.y, 1)
      }
      for (const structure of this.structures.obstacles) {
        if (structure.structureType === STRUCTURE_WALL) {
          costs.set(structure.pos.x, structure.pos.y, Math.max(20, Math.min(254, Math.ceil(structure.hits / 100000))))
          continue
        }
        costs.set(structure.pos.x, structure.pos.y, 10)
      }
      for (const structure of this.structures.rampart) {
        if (structure.my || structure.isPublic) {
          continue
        }
        costs.set(
          structure.pos.x,
          structure.pos.y,
          Math.max(20, Math.min(254, Math.ceil(costs.get(structure.pos.x, structure.pos.y) + structure.hits / 100000)))
        )
      }
      for (const creep of this.find(FIND_MY_CREEPS)) {
        costs.set(creep.pos.x, creep.pos.y, 255)
      }
      return (this._costmatrixForBattle = costs)
    },
  },
  hostile: {
    get() {
      if (!this.controller) {
        return false
      }
      if (!this.controller.owner) {
        return false
      }
      if (this.isMy) {
        return false
      }
      const username = this.controller.username
      if (allies.includes(username)) {
        return false
      }
      return true
    },
  },
  isMy: {
    get() {
      return this.controller && this.controller.my
    },
  },
  isMyRemote: {
    get() {
      return this.controller && this.controller.reservation && this.controller.reservation.username === MY_NAME
    },
  },
  maxWork: {
    get() {
      if (this.controller.level === 1) {
        return 4
      }
      if (Game.time % 11 === 0) {
        delete this.heap.maxWork
      }

      if (this.heap.maxWork !== undefined) {
        return this.heap.maxWork
      }

      return (this.heap.maxWork = this.getMaxWork())
    },
  },
  terrain: {
    get() {
      if (!this._terrain) {
        this._terrain = new Room.Terrain(this.name)
      }
      return this._terrain
    },
  },
  weakestRampart: {
    get() {
      if (this._weakestRampart) {
        return this._weakestRampart
      }
      const ramparts = this.structures.rampart
      if (ramparts.length) {
        this._weakestRampart = Util.getMinObject(ramparts, (rampart) => rampart.hits)
      }
      return this._weakestRampart
    },
  },
  hyperLink: {
    get() {
      const URL = `https://screeps.com/a/#!/room/${SHARD}/${this.name}`
      return `<a href="${URL}" target="_blank">${this.name}</a>`
    },
  },
})

Room.prototype.getIsWrecked = function () {
  const hasSpawn = this.structures.spawn.length > 0
  const level = this.controller.level
  if (level > 1 && !hasSpawn) {
    return true
  }
  return false
}

Room.prototype.getMaxWork = function () {
  const numWorkEach = this.laborer.numWorkEach
  const constructing = this.constructionSites.length > 0

  if (!this.storage) {
    // former is spawn limit. latter is income limit
    const basicNumWork = (this.heap.sourceUtilizationRate || 0) * 12
    const remoteSurplusNumWork = Math.max(0, this.memory.currentRemoteIncome || 0)
    const numUpgradeSpot = this.controller.available

    const result = Math.floor(basicNumWork + remoteSurplusNumWork) - (constructing ? 6 * BUILD_POWER : 0)
    const max = numUpgradeSpot * numWorkEach
    const min = 0
    return (this.heap.maxWork = Math.clamp(result, min, max))
  }

  const level = this.controller.level

  const upgradeNeeded = this.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[level] / 2

  if (level === 8) {
    // if downgrade is close, upgrade
    if (upgradeNeeded) {
      this.heap.upgrading = true
      if (config.blockUpragade) {
        return 1
      }
      return 15
    }

    if (config.blockUpragade) {
      return 0
    }

    const upgrading = (this.heap.upgrading = this.energyLevel >= config.energyLevel.UPGRADE_MAX_RCL)

    // if constructing, maxWork = energyLevel * 5
    if (constructing) {
      this.heap.upgrading = false
      return upgrading ? 5 : 0
    }

    return this.heap.upgrading ? 15 : 0
  }

  if (this.energyLevel < config.energyLevel.UPGRADE) {
    return 5
  }

  const upperLimit = this.getUpgradeUpperLimit()

  const lowerLimit = upgradeNeeded ? 5 : 0

  const extra = Math.max(0, Math.floor((this.energyLevel - config.energyLevel.UPGRADE) / 10))

  return Math.floor(Math.clamp(10 * Math.pow(1 + extra, 1.2), lowerLimit, upperLimit))
}

Room.prototype.getUpgradeUpperLimit = function () {
  if (!this.storage || !this.terminal) {
    return MAX_WORK
  }
  const funnelRequest = Overlord.getBestFunnelRequest()
  if (!funnelRequest) {
    return this.controller.linkFlow || MAX_WORK
  }
  return this.controller.linkFlow || MAX_WORK
}

Room.prototype.getTotalEnergy = function () {
  return this.getResourceAmount(RESOURCE_ENERGY) + 10 * this.getResourceAmount(RESOURCE_BATTERY)
}

Room.prototype.getTotalFreeCapacity = function () {
  if (this._totalFreeCapacity !== undefined) {
    return this._totalFreeCapacity
  }

  let result = 0
  if (this.storage) {
    result += this.storage.store.getFreeCapacity()
  }
  if (this.terminal) {
    result += this.terminal.store.getFreeCapacity()
  }
  if (this.structures.factory[0]) {
    result += this.structures.factory[0].store.getFreeCapacity()
  }

  return (this._totalFreeCapacity = result)
}

Room.prototype.getResourceAmount = function (resourceType) {
  const storage = this.storage
  const factories = this.structures.factory
  const terminal = this.terminal

  let result = 0

  if (storage) {
    result += storage.store[resourceType] || 0
  }

  if (factories) {
    for (const factory of factories) {
      result += factory.store[resourceType] || 0
    }
  }

  if (terminal) {
    result += terminal.store[resourceType] || 0
  }

  return result
}

Room.prototype.getEnergyLevel = function () {
  if (this._energyLevel) {
    return this._energyLevel
  }

  const totalEnergy = this.getTotalEnergy()

  const standard = ECONOMY_STANDARD[this.controller.level]

  const result = Math.floor((100 * totalEnergy) / standard)

  return (this._energyLevel = result)
}

Room.prototype.getBasicSpawnCapacity = function () {
  if (!this.isMy) {
    return 0
  }

  if (this._basicSpawnCapacity !== undefined) {
    return this._basicSpawnCapacity
  }

  const level = this.controller.level

  // 2 miners, 10 parts each
  let result = 20

  // haulers
  for (const source of this.sources) {
    if (source.linked) {
      continue
    }
    const maxCarry = source.info.maxCarry
    result += Math.ceil(maxCarry * 1.5)
  }

  // manager + researcher
  const numManager = this.getMaxNumManager()
  result += 1.5 * Math.min(MANAGER_MAX_CARRY, 2 * Math.floor(this.energyCapacityAvailable / 150)) * numManager

  //laborer
  const basicNumWork = 12
  result += basicNumWork * 2

  //extractor
  if (level >= 6) {
    result += Math.min(10, Math.floor(this.energyAvailable / 450)) * 5
  }

  //wallMaker
  if (level >= config.rampartLevel) {
    result += Math.min(16, Math.floor(this.energyCapacityAvailable / 200)) * 3
  }

  return (this._basicSpawnCapacity = result)
}

Room.prototype.getDepositSpawnCapacity = function (depositRequest) {
  return depositRequest.available * 50 + 100
}

Room.prototype.getSpawnCapacity = function () {
  let result = 0

  result += this.getBasicSpawnCapacity()

  const activeRemotes = this.getActiveRemotes()
  if (activeRemotes) {
    for (const info of activeRemotes) {
      if (info.block) {
        continue
      }
      result += info.weight
    }
  }

  result += Math.ceil(this.maxWork * 1.4)

  if (this.memory.depositRequests) {
    for (const depositRequest of Object.values(this.memory.depositRequests)) {
      result += this.getDepositSpawnCapacity(depositRequest)
    }
  }

  return Math.ceil(result)
}

Room.prototype.getSpawnCapacityRatio = function () {
  const spawnCapacity = this.getSpawnCapacity()
  const spawnCapacityAvailable = this.structures.spawn.length * 500
  return spawnCapacity / spawnCapacityAvailable
}

Room.prototype.getEnemyCombatants = function () {
  if (this._enemyCombatants !== undefined) {
    return this._enemyCombatants
  }
  const enemyCreeps = [...this.findHostileCreeps()]
  const enemyCombatants = enemyCreeps.filter((creep) => creep.checkBodyParts(['attack', 'ranged_attack', 'heal']))
  return (this._enemyCombatants = enemyCombatants)
}

Room.prototype.getMyCombatants = function () {
  if (this._myCombatants !== undefined) {
    return this._myCombatants
  }
  const myCreeps = this.find(FIND_MY_CREEPS)
  const myCombatants = myCreeps.filter((creep) => creep.checkBodyParts(['attack', 'ranged_attack', 'heal']))
  return (this._myCombatants = myCombatants)
}

Room.prototype.getIsDefender = function () {
  if (this._isDefender !== undefined) {
    return this._isDefender
  }
  const myCreeps = this.find(FIND_MY_CREEPS)
  for (const creep of myCreeps) {
    if (creep.memory.role === 'colonyDefender' && creep.memory.colony === this.name) {
      return (this._isDefender = true)
    }
  }
  return (this._isDefender = false)
}

/**
 *
 * @param {string} roomName - roomName to send troops
 * @param {*} cost - total cost to be used to spawn troops
 * @returns whether there are enough troops or not
 */
Room.prototype.sendTroops = function (roomName, cost, options) {
  const defaultOptions = { distance: 0, task: undefined, model: 70 }
  const mergedOptions = { ...defaultOptions, ...options }
  const { distance, task, model } = mergedOptions

  const buffer = 100

  let colonyDefenders = Overlord.getCreepsByRole(roomName, 'colonyDefender')

  if (distance > 0) {
    colonyDefenders = colonyDefenders.filter(
      (creep) => (creep.ticksToLive || 1500) > distance + creep.body.length * CREEP_SPAWN_TIME + buffer
    )
  }

  const requestedCost = cost

  if (requestedCost === 0) {
    if (colonyDefenders.length === 0) {
      this.requestColonyDefender(roomName, { doCost: false, costMax: 3000, task })
      return false
    }
    for (const colonyDefender of colonyDefenders) {
      colonyDefender.memory.waitForTroops = false
    }
    return true
  }

  let totalCost = 0

  for (const colonyDefender of colonyDefenders) {
    const multiplier = colonyDefender.memory.boosted !== undefined ? 4 : 1
    totalCost += colonyDefender.getCost() * multiplier
  }

  if (totalCost >= requestedCost) {
    if (colonyDefenders.find((colonyDefender) => colonyDefender.spawning)) {
      return true
    }
    for (const colonyDefender of colonyDefenders) {
      colonyDefender.memory.waitForTroops = false
    }
    return true
  }

  const costMax = Math.max(5600)
  this.requestColonyDefender(roomName, { doCost: false, costMax, waitForTroops: true, task })

  return false
}
