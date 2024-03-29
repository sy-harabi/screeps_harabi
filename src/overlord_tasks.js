const METHODS_BY_CATEGORY = {
  powerBank: `managePowerBankTasks`,
  deposit: 'manageDepositTasks',
  guard: 'manageGuardTasks',
  quad: 'manageQuadTasks',
  duo: `manageDuoTasks`,
  siege: 'manageSiegeTasks',
  siegeDuo: 'manageSiegeDuoTasks',
  blinky: 'manageBlinkyTasks',
  occupy: 'manageOccupyTasks',
  singleton: 'manageSingletonTasks',
  mineral: 'manageMineralTasks',
  claim: 'manageClaimTasks',
  harass: 'manageHarassTasks',
  transport: 'manageTransportTasks',
}

Overlord.runTasks = function () {
  const categories = this.getTaskCategories()
  for (const category of categories) {
    try {
      const functionName = METHODS_BY_CATEGORY[category]
      Overlord[functionName]()
    } catch (err) {
      data.recordError(err, category)
    }
  }
}

Object.defineProperties(Overlord, {
  tasks: {
    get() {
      if (Memory.tasks) {
        return Memory.tasks
      }
      return (Memory.tasks = {})
    },
  },
})

Overlord.getTasksByRoomInCharge = function (roomName) {
  const result = {}

  const categories = Overlord.getTaskCategories()

  for (const category of categories) {
    result[category] = result[category] || {}
    const tasks = Overlord.tasks[category]
    for (const task of Object.values(tasks)) {
      if (task.roomNameInCharge !== roomName) {
        continue
      }
      result[category][task.id] = task
    }
  }

  return result
}

Overlord.getTaskCategories = function () {
  return Object.keys(METHODS_BY_CATEGORY)
}

Overlord.getTask = function (category, id) {
  if (!Overlord.tasks[category]) {
    return undefined
  }

  return Overlord.tasks[category][id]
}

Overlord.getTasksWithCategory = function (category) {
  Overlord.tasks[category] = Overlord.tasks[category] || {}
  return Overlord.tasks[category]
}

Overlord.registerTask = function (task) {
  const category = task.category
  if (!category) {
    console.log(`no category for ${JSON.stringify(task)}`)
    return
  }
  const tasks = this.getTasksWithCategory(category)
  tasks[task.id] = task
}

Overlord.deleteTask = function (task) {
  const category = task.category
  const tasks = this.getTasksWithCategory(category)
  delete tasks[task.id]
  return
}
