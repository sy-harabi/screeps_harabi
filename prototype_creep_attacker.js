Creep.prototype.attackNear = function () {
    const hostileCreeps = this.room.find(FIND_HOSTILE_CREEPS)
    let rangedHostileCreep = this.pos.findInRange(hostileCreeps, 2).sort((a, b) => a.hits - b.hits)[0]
    if (rangedHostileCreep) {
        this.rangedAttack(rangedHostileCreep)
        return
    }

    const hostileStructure = this.room.find(FIND_HOSTILE_STRUCTURES)
    let rangedHostileStructure = this.pos.findInRange(hostileStructure, 2).sort((a, b) => a.hits - b.hits)[0]
    if (rangedHostileStructure) {
        this.rangedAttack(rangedHostileStructure)
        return
    }
}

Creep.prototype.attackSpawn = function (roomName) {
    const healer = Game.creeps[this.memory.healer]
    if (this.spawning) {
        return
    }
    if (this.room.name === roomName) {
        const spawn = this.pos.findClosestByRange(this.room.structures.spawn)

        const hostileCreeps = this.room.find(FIND_HOSTILE_CREEPS)
        const hostileCreep = this.pos.findClosestByRange(hostileCreeps)
        const hostileStructures = this.room.find(FIND_HOSTILE_STRUCTURES).filter(s => s !== this.room.controller && s.structureType !== 'rampart' && !(s.store && s.store.getUsedCapacity() > 1000))
        const hostileStructure = this.pos.findClosestByRange(hostileStructures)
        const target = hostileCreep || hostileStructure
        if (!target) {
            const controller = this.room.controller
            if (controller && (!controller.sign || controller.sign.username !== this.owner.username)) {
                if (this.signController(controller, "I will come back and take this room") === -9) {
                    this.moveMy(controller, 1)
                }
            }
            else {
                if (this.pos.getRangeTo(controller) > 1) {
                    this.moveMy(controller, 1)
                }
                for (const flag of this.room.find(FIND_FLAGS)) {
                    flag.remove()
                }
                return
            }
        }

        if (!spawn) {
            if (healer.fatigue === 0) {
                this.moveMy(target, 1)
            }
            this.attack(target)
            this.attackNear()
            return
        }

        let path = PathFinder.search(this.pos, { pos: spawn.pos, range: 1 }, {
            plainCost: 2,
            swampCost: 10,
            maxRooms: 1,
            roomCallback: function (roomName) {
                return Game.rooms[roomName].costmatrixForBattle
            }
        }).path

        let isRampartWall = false
        for (const pos of path) {
            if (pos.lookFor(LOOK_STRUCTURES).filter(obj => obj.structureType === 'constructedWall' || obj.structureType === 'rampart').length) {
                isRampartWall = true
                break
            }
        }

        // if (!isRampartWall && hostileCreep && this.pos.getRangeTo(hostileCreep) < this.pos.getRangeTo(spawn)) {
        //     this.moveTo(hostileCreep, { range: 1 })
        //     this.attack(hostileCreep)
        //     this.attackNear()
        //     return
        // }

        this.room.visual.poly(path)
        if (path.length) {
            let structureOnPath = path[0].lookFor(LOOK_STRUCTURES).filter(obj => OBSTACLE_OBJECT_TYPES.includes(obj.structureType))[0]
            let rampartOnPath = path[0].lookFor(LOOK_STRUCTURES).filter(obj => obj.structureType === 'rampart')[0]
            if (rampartOnPath) {
                this.attack(rampartOnPath)
                this.rangedAttack(rampartOnPath)
                return
            }
            if (structureOnPath) {
                this.attack(structureOnPath)
                this.rangedAttack(structureOnPath)
                return
            }
            if (healer.fatigue === 0) {
                this.move(this.pos.getDirectionTo(path[0]))
            }
            this.attackNear()
            return
        } else {
            if (this.attack(spawn) === -9) {
                if (healer.fatigue === 0) {
                    this.moveMy(spawn, 1)
                }
            } else {
                this.rangedAttack(spawn)
            }
        }

    } else {
        if (this.hitsMax === this.hits) {
            this.moveToRoom(roomName);
            this.say('attack')
        } else {
            this.retreat()
            this.say('retreat')
        }
    }
}

Creep.prototype.retreat = function () {
    const base = new RoomPosition(25, 25, this.memory.base)
    const healer = Game.creeps[this.memory.healer]
    if (healer && this.room.name === healer.room.name && this.pos.getRangeTo(healer) > 1) {
        this.attackNear()
        return
    }
    this.moveMy(base, 22)
    this.attackNear()
}

Creep.prototype.attackRoom = function (roomName) {
    const healer = Game.creeps[this.memory.healer]
    const status = this.hits / this.hitsMax
    const healerStauts = (healer && !healer.spawning) ? healer.hits / healer.hitsMax : 0

    if (!(status > 0.8 && healerStauts > 0.8)) {
        this.retreat()
        this.say('retreat')
        return
    }
    if (healer && !healer.spawning && this.room.name === healer.room.name && this.pos.getRangeTo(healer) > 1) {
        this.attackNear()
        return
    }
    if (this.room.name = roomName) {
        this.say('attack')
        this.attackSpawn(roomName)
        return
    } else {
        if (status === 1 && healerStauts === 1) {
            this.say('attack')
            this.attackSpawn(roomName)
            return
        }
        this.retreat()
        this.say('retreat')
        return
    }
}

Creep.prototype.care = function (target) {
    if (!target) {
        return
    }
    if (this.room.name === target.room.name && this.pos.getRangeTo(target) <= 1 && !isValidCoord(this.pos.x, this.pos.y)) {
        const nearTarget = target.pos.getAtRange(1).filter(pos => isValidCoord(pos.x, pos.y))
        this.say('retreat')
        this.moveMy(this.pos.findClosestByRange(nearTarget))
    } else {
        this.say('follow')
        this.moveMy(target)
    }

    const targetToheal = this.hits / this.hitsMax > target.hits / target.hitsMax ? target : this
    this.rangedHeal(targetToheal)
    this.heal(targetToheal)
}