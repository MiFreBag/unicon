export default function mqttMatch(filter, topic, delimiter='/' /*handleSharedSubscription = false*/) {
    const filterArray = filter.split(delimiter)
  
    // // handle shared subscrition
    // if (handleSharedSubscription && filterArray.length > 2 && filter.startsWith('$share/')) {
    //   filterArray.splice(0, 2)
    // }
    const swc = delimiter==='.'? '*' : '+';

    const length = filterArray.length
    const topicArray = topic.split(delimiter)
  
    for (let i = 0; i < length; ++i) {
      const left = filterArray[i]
      const right = topicArray[i]
      if (left === '#') return topicArray.length >= length - 1
      if (left !== swc && left !== right) return false
    }
  
    return length === topicArray.length
  }