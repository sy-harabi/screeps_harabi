Object.defineProperties(RoomPosition.prototype, {
  available: {
    get() {
      if (this._available) {
        return this._available
      }
      this._available =
        9 -
        Game.rooms[this.roomName]
          .lookForAtArea(LOOK_TERRAIN, this.y - 1, this.x - 1, this.y + 1, this.x + 1, true)
          .filter((position) => position.terrain === 'wall').length
      return this._available
    },
  },
  terrain: {
    get() {
      if (!this._terrain) {
        this._terrain = new Room.Terrain(this.roomName).get(this.x, this.y)
      }
      return this._terrain
    },
  },
  isWall: {
    get() {
      return this.terrain === 1
    },
  },
  isSwamp: {
    get() {
      if (this.isRoad) {
        return false
      }
      return this.terrain === 2
    },
  },
  isRampart: {
    get() {
      if (this._isRampart !== undefined) {
        return this._isRampart
      }
      return (this._isRampart =
        this.lookFor(LOOK_STRUCTURES).filter((structure) => structure.structureType === 'rampart').length > 0)
    },
  },
  workable: {
    get() {
      if (this._workable !== undefined) {
        return this._workable
      }
      this._workable = true
      for (const lookObject of this.look()) {
        if (lookObject.type === 'terrain' && lookObject.terrain === 'wall') {
          this._workable = false
          break
        }
        if (isEdgeCoord(this.x, this.y)) {
          this._workable = false
          break
        }
        if (
          lookObject.type === LOOK_STRUCTURES &&
          OBSTACLE_OBJECT_TYPES.includes(lookObject[LOOK_STRUCTURES].structureType)
        ) {
          this._workable = false
          break
        }
        if (lookObject.type === LOOK_CONSTRUCTION_SITES) {
          this._workable = false
          break
        }
      }
      return this._workable
    },
  },
  walkable: {
    get() {
      if (isEdgeCoord(this.x, this.y)) {
        return false
      }
      this._walkable = true
      for (const lookObject of this.look()) {
        if (lookObject.type === LOOK_TERRAIN && lookObject[LOOK_TERRAIN] === 'wall') {
          this._walkable = false
          break
        }
        if (
          lookObject.type === LOOK_STRUCTURES &&
          OBSTACLE_OBJECT_TYPES.includes(lookObject[LOOK_STRUCTURES].structureType)
        ) {
          this._walkable = false
          break
        }
        if (lookObject.type === LOOK_CONSTRUCTION_SITES) {
          const structureType = lookObject.constructionSite.structureType
          if (OBSTACLE_OBJECT_TYPES.includes(structureType)) {
            this._walkable = false
            break
          }
        }
      }
      return this._walkable
    },
  },
  constructible: {
    get() {
      if (this.lookFor(LOOK_TERRAIN)[0] === 'wall') {
        return false
      }
      if (this.x < 2 || this.x > 47 || this.y < 2 || this.y > 47) {
        return false
      }
      if (this.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) {
        return false
      }
      for (const structure of this.lookFor(LOOK_STRUCTURES)) {
        if (structure.structureType !== STRUCTURE_RAMPART) {
          return false
        }
      }
      return true
    },
  },
  crossConstructible: {
    get() {
      const cross = this.getCross()
      if (cross.length < 5) {
        return false
      }
      for (const pos of cross) {
        if (!pos.constructible) {
          return false
        }
      }
      return true
    },
  },
  closestMyRoom: {
    get() {
      if (!Memory.rooms[this.roomName].closestMyRoom) {
        const closestMyRoom = Game.rooms
          .filter((room) => room.isMy)
          .sort((a, b) => Game.map.findRoute(this.name, a.name) - Game.map.findRoute(this.name, b.name))[0]
        Memory.rooms[this.roomName].closestMyRoom = closestMyRoom.name
      }
      return Game.rooms[Memory.rooms[this.roomName].closestMyRoom]
    },
  },
})

RoomPosition.prototype.getTaxiRangeTo = function (target) {
  const targetPos = target.pos || target
  if (this.roomName !== targetPos.roomName) {
    return Infinity
  }
  return Math.abs(this.x - targetPos.x) + Math.abs(this.y - targetPos.y)
}

RoomPosition.prototype.lookForConstructible = function (vectorArray) {
  for (const vector of vectorArray) {
    const x = this.x + vector.x
    const y = this.y + vector.y
    if (!isValidCoord(x, y)) {
      return false
    }
    const pos = new RoomPosition(x, y, this.roomName)
    if (!pos.constructible) {
      return false
    }
  }
  return true
}

RoomPosition.prototype.pack = function () {
  return this.y * 50 + this.x
}

Room.prototype.parsePos = function (packed) {
  const x = packed % 50
  const y = (packed - x) / 50
  if (!isValidCoord(x, y)) {
    return undefined
  }
  return new RoomPosition(x, y, this.name)
}

RoomPosition.prototype.getRangeToEdge = function () {
  return Math.min(this.x, 49 - this.x, this.y, 49 - this.y)
}

RoomPosition.prototype.getAtRange = function (range) {
  if ((i = 0)) {
    return [this]
  }
  const result = []

  for (let i = -range; i <= range; i++) {
    if (isValidCoord(this.x + i, this.y + range)) {
      result.push(new RoomPosition(this.x + i, this.y + range, this.roomName))
    }
    if (isValidCoord(this.x + i, this.y - range)) {
      result.push(new RoomPosition(this.x + i, this.y - range, this.roomName))
    }
  }
  for (let i = -range + 1; i < range; i++) {
    if (isValidCoord(this.x + range, this.y + i)) {
      result.push(new RoomPosition(this.x + range, this.y + i, this.roomName))
    }
    if (isValidCoord(this.x - range, this.y + i)) {
      result.push(new RoomPosition(this.x - range, this.y + i, this.roomName))
    }
  }
  return result
}

RoomPosition.prototype.getInRange = function (range) {
  const result = []

  for (let i = this.x - range; i <= this.x + range; i++) {
    if (i < 0 || i > 49) {
      continue
    }
    for (j = this.y - range; j <= this.y + range; j++) {
      if (j < 0 || j > 49) {
        continue
      }
      result.push(new RoomPosition(i, j, this.roomName))
    }
  }

  return result
}

RoomPosition.prototype.getAverageRange = function (array) {
  if (!array.length) {
    return false
  }
  let result = 0
  for (const object of array) {
    result += this.getRangeTo(object.pos || object)
  }
  return result / array.length
}

RoomPosition.prototype.getClosestPathLength = function (array, costs) {
  if (costs === undefined) {
    costs = new PathFinder.CostMatrix()
  }
  const goals = array.map((obj) => obj.pos || obj)
  const search = PathFinder.search(this, goals, {
    roomCallback: (roomName) => costs,
  })
  if (search.incomplete) {
    return 255
  }
  return search.path.length
}

RoomPosition.prototype.getClosestByPath = function (array) {
  const goals = array.map((obj) => obj.pos || obj)
  const search = PathFinder.search(this, goals)
  if (search.incomplete) {
    return undefined
  }
  const path = search.path
  return path[path.length - 1]
}

RoomPosition.prototype.getClosestTaxiRange = function (array) {
  let result = Infinity
  for (const obj of array) {
    const newResult = this.getTaxiRangeTo(obj)
    if (newResult < result) {
      result = newResult
    }
  }
  return result
}

RoomPosition.prototype.getClosestRange = function (array) {
  let result = Infinity
  for (const obj of array) {
    const newResult = this.getRangeTo(obj)
    if (newResult < result) {
      result = newResult
    }
  }
  return result
}

RoomPosition.prototype.getRangeToMy = function (target) {
  const targetPos = target.pos || target

  const thisWorldPos = fromRoomPosition(this)
  const targetWorldPos = fromRoomPosition(targetPos)

  return Math.max(Math.abs(thisWorldPos.x - targetWorldPos.x), Math.abs(thisWorldPos.y - targetWorldPos.y))
}

function fromRoomPosition(roomPos) {
  let { x, y, roomName } = roomPos
  let [name, h, wx, v, wy] = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/)
  if (h == 'W') x = ~x
  if (v == 'N') y = ~y
  return { x: 49 * wx + x, y: 49 * wy + y }
}
