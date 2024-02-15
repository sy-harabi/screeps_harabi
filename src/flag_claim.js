const { BlinkyRequest } = require('./overlord_tasks_blinky');

Room.prototype.manageClaim = function () {
    this.memory.claimRoom = this.memory.claimRoom || {};
    const roomNames = Object.keys(this.memory.claimRoom);
    if (roomNames.length === 0) {
        return;
    }

    for (const roomName of Object.keys(this.memory.claimRoom)) {
        Game.map.visual.line(new RoomPosition(25, 25, this.name), new RoomPosition(25, 25, roomName), {
            color: '#001eff',
            width: '2',
            opacity: 1,
        });
        Game.map.visual.circle(new RoomPosition(25, 25, roomName), { fill: '#001eff' });
        return this.claimRoom(roomName);
    }
};

Room.prototype.claimRoom = function (roomName) {
    // room memory에 status object 만들기
    this.memory.claimRoom = this.memory.claimRoom || {};
    this.memory.claimRoom[roomName] = this.memory.claimRoom[roomName] || {};
    const status = this.memory.claimRoom[roomName];

    // targetRoom (안보이면 undefined)
    const targetRoom = Game.rooms[roomName];

    // defense part
    const tasks = Overlord.getTasksByRoomInCharge(this.name);
    const blinkyTasks = Object.values(tasks['blinky']);

    if (!blinkyTasks.some((request) => request.ticksToLive > 900)) {
        const request = new BlinkyRequest(this, roomName, { number: 1, boost: 0 });
        Overlord.registerTask(request);
    }

    // claim part
    if (targetRoom && targetRoom.isMy) {
        status.isClaimed = true;
    } else {
        status.isClaimed = false;
        const claimer = Overlord.getCreepsByRole(roomName, 'claimer')[0];
        if (!claimer) {
            this.requestClaimer(roomName);
        }
    }

    // clear part
    if (status.isClaimed && !status.isCleared) {
        for (const site of targetRoom.find(FIND_HOSTILE_CONSTRUCTION_SITES)) {
            site.remove();
        }
        const structures = targetRoom.find(FIND_STRUCTURES);
        let numLeft = 0;
        let numDone = 0;
        for (const structure of structures) {
            // 내 건물은 넘어가
            if (structure.my) {
                continue;
            }
            // road, container 등은 한 번만 부수고 그담부턴 넘어가
            if (!structure.owner && status.isClearedOnce) {
                continue;
            }
            // 남아있던 건물들은 에너지 있는 동안은 냅둬
            if (
                structure.owner &&
                structure.store &&
                structure.store[RESOURCE_ENERGY] > 100 &&
                targetRoom.controller.level < 4
            ) {
                numLeft++;
                continue;
            }
            numDone++;
            structure.destroy();
        }

        if (numDone === 0) {
            status.isClearedOnce = true;
        }

        if (numLeft === 0 && numDone === 0) {
            status.isCleared = true;
        }
    }

    // 아직 claim 안된거면 여기서 멈춰
    if (!status.isClaimed) {
        return;
    }

    // 작동하는 타워까지 있으면 이제 claim 끝
    const spawn = targetRoom.structures.spawn[0];
    if (spawn && !spawn.pos.isRampart) {
        spawn.pos.createConstructionSite('rampart');
    }
    const towerActive = targetRoom.structures.tower.filter(
        (tower) => tower.RCLActionable && tower.store[RESOURCE_ENERGY] > 0
    );
    for (const tower of towerActive) {
        if (tower && !tower.pos.isRampart) {
            tower.pos.createConstructionSite('rampart');
        }
    }

    if (targetRoom && spawn && towerActive.length >= 1 && status.isCleared) {
        delete this.memory.claimRoom[roomName];
        return;
    }

    // pioneer part

    // spawn 생기면 보내지 말자
    if (spawn) {
        return;
    }

    const pioneers = Overlord.getCreepsByRole(roomName, 'pioneer').filter(
        (creep) => creep.spawning || creep.ticksToLive > CREEP_LIFE_TIME - 600
    );
    let numWork = 0;
    for (const pioneer of pioneers) {
        numWork += pioneer.getNumParts('work');
    }
    let number = pioneers.length ? Math.max(...pioneers.map((pioneer) => pioneer.memory.number)) : 0;
    if (numWork < 10) {
        number++;
        return this.requestPioneer(roomName, number);
    }
};
