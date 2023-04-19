// Import KPuzzle and Cubing.js random scramble dependencies
import { randomScrambleForEvent } from "https://cdn.cubing.net/js/cubing/scramble";
import { puzzles } from "https://cdn.cubing.net/js/cubing/puzzles"

const timer = document.querySelector("#timer")
let isRunning = false
var interval = null; 
let arr = []
let tableBody = document.getElementsByTagName('tbody')[0]
let scrambleElem = document.getElementById('scramble')

function processDataForNN(preProcessedData) {
    let inputArr = []
    let outputArr = []
    let modifiedTrainingData = []
    for (let i=0; i< preProcessedData.length; i++) {
        outputArr.push(preProcessedData[i][0])
        inputArr.push(preProcessedData[i][2])
    }

    let minTime = Math.min(...outputArr)
    let maxMinusMin = Math.max(...outputArr) - minTime

    console.log("MMM >>>> ", maxMinusMin)
    console.log("min >>>> ", minTime)

    for (let j=0; j<outputArr.length; j++) {
        outputArr[j] = (outputArr[j]-minTime)/maxMinusMin
    }
    
    for (let k=0; k< preProcessedData.length; k++) {
        modifiedTrainingData.push({
            input: preProcessedData[k][2],
            output: [outputArr[k]]
        })
    }
    
    return modifiedTrainingData
}

function trainNN(trainingData, netName) {
    const config = {
        binaryThresh: 0.5,
        hiddenLayers: [3,3,3], // array of ints for the sizes of the hidden layers in the network
        activation: 'sigmoid', // supported activation types: ['sigmoid', 'relu', 'leaky-relu', 'tanh'],
        leakyReluAlpha: 0.01, // supported for activation type 'leaky-relu'
        learningRate: 0.3
    };
    
    // create a simple feed forward neural network with backpropagation
    const net = new brain.NeuralNetwork(config);
    net
        .trainAsync(trainingData, {log: true, iterations: 20000, logPeriod: 100})
        .then((res) => {
            localStorage.setItem(netName, JSON.stringify(net.toFunction().toString()))
        })
        .catch((e) => {
            console.log(e)
        })
    return net
}

function runTraining() {
    // Get scramble & time data from local storage
    let myTrainingData = JSON.parse(localStorage.getItem('times'))

    // Pre-process data for use in NN
    let parsedTraningData = processDataForNN(myTrainingData)

    // Train NN on processed data
    trainNN(parsedTraningData, 'net')
}

async function getScramble() {
    // Set loading text
    let scrambleElem = document.getElementById('scramble')
    scrambleElem.innerText = "Loading..."

    // Get saved NN and make into function
    let net = JSON.parse(localStorage.getItem('EllisNet'))
    var myFunc = eval('(' + net + ')');

    // Get scramble and puzzle instance from cubing.js CDN
    let scramble = await randomScrambleForEvent("333");
    let kPuzzle = await puzzles['3x3x3']['kpuzzle']()

    // Turn scramble into array of piece info and pass into NN, saving value of difficulty
    let transformationData = kPuzzle.algToTransformation("U' F2 D' R2 F2 U' L2 B2 D L2 U' F2 R' F2 L' B2 R' B' R D").transformationData
    let eo = transformationData.EDGES.orientation.map(x => x/Math.max(...transformationData.EDGES.orientation))
    let ep = transformationData.EDGES.permutation.map(x => x/Math.max(...transformationData.EDGES.permutation))
    let co = transformationData.CORNERS.orientation.map(x => x/Math.max(...transformationData.CORNERS.orientation))
    let cp = transformationData.CORNERS.permutation.map(x => x/Math.max(...transformationData.CORNERS.permutation))
    let mergedArr = [...eo, ...ep, ...co, ...cp]
    let scrambleDifficulty = myFunc(mergedArr)
    console.log(scrambleDifficulty)

    // Check if scramble hard enough and log to screen
    if (scrambleDifficulty < .9999) {
        scrambleElem.innerText = scramble
    } else {
        getScramble()
    }
    return
}

async function processKPuzzle(scram) {
    let kPuzzle = await puzzles['3x3x3']['kpuzzle']()
    let transformationData = kPuzzle.algToTransformation(scram).transformationData
    let eo = transformationData.EDGES.orientation.map(x => x/Math.max(...transformationData.EDGES.orientation))
    let ep = transformationData.EDGES.permutation.map(x => x/Math.max(...transformationData.EDGES.permutation))
    let co = transformationData.CORNERS.orientation.map(x => x/Math.max(...transformationData.CORNERS.orientation))
    let cp = transformationData.CORNERS.permutation.map(x => x/Math.max(...transformationData.CORNERS.permutation))
    let mergedArr = [...eo, ...ep, ...co, ...cp]
    return mergedArr
}

let updateTimeLog = async function(time) {
    let mergedArr = await processKPuzzle(scrambleElem.innerText)
    if (!localStorage.getItem('times')) {
        localStorage.setItem('times',JSON.stringify([[time,scrambleElem.innerText,mergedArr]]))
        arr = JSON.parse(localStorage.getItem('times'))
    } else {
        arr = JSON.parse(localStorage.getItem('times'))
        arr.push([time,scrambleElem.innerText,mergedArr])
        localStorage.setItem('times', JSON.stringify(arr))
    }

    // Subtract 4 tr's from the stat list, and another to adjust for index
    let currentNumOfTimes = document.querySelectorAll('tr').length - 9
    arr = arr.slice(currentNumOfTimes, arr.length)

    addTableData(arr)
    getScramble()
    updateStats()

    let timeTable = document.querySelector('.table-container')
    timeTable.scrollTop = timeTable.scrollHeight;

    return
}

function updateStats() {
    let data = JSON.parse(localStorage.getItem('times'))
    let currentTds = document.getElementById('current-avg').querySelectorAll('tr td:nth-child(2)')
    let justTimes = data.map(row => row[0])
    let currentStats = [avgLastNofArr(justTimes,3),avgLastNofArr(justTimes,5),avgLastNofArr(justTimes,12)]
    for (let k=0; k < currentTds.length; k++) {
        currentTds[k].innerText = currentStats[k].toFixed(2)
    }
}

function avgLastNofArr(arr, n) {
    arr = arr.slice(-n)
    let numTimesToRemove

    if (n==3) {
        numTimesToRemove = 0
    } else if (n==5 || n==12) {
        numTimesToRemove = 2
    } else {
        numTimesToRemove = Math.round(.1*arr.length)
    }

    if (numTimesToRemove != 0) {
        let half = Math.round(numTimesToRemove/2)
        for (let i = 0; i < half; i++) {
            arr.splice(arr.indexOf(Math.max(...arr)),1)
            arr.splice(arr.indexOf(Math.min(...arr)),1)
        }
    }

    return arr.reduce((total,current) => total + current)/arr.length
}

let addTableData = function(arr) {
    let lastEntry = tableBody.lastChild.children ? Number(tableBody.lastChild.children[1].innerText) : 0
    for (let j=1; j <= arr.length; j++) {
        let newRow = document.createElement('tr')
        let newSolveNum = document.createElement('td')
        let newTime = document.createElement('td')
        let closeBtnCell = document.createElement('td')
        let btnSpan = document.createElement('span')
        btnSpan.innerText = 'x'
        btnSpan.addEventListener('click', handleDelete)
        closeBtnCell.appendChild(btnSpan)
        newRow.append(closeBtnCell, newSolveNum, newTime)
        newSolveNum.innerText = arr.length == 1 ? lastEntry + 1 : j
        newTime.innerText = arr[j-1][0].toFixed(2)
        tableBody.appendChild(newRow)
    }
}

let handleDelete = function(event) {
    let parentRow = event.srcElement.parentElement.parentElement
    let index = Number(parentRow.querySelectorAll('td')[1].innerText) - 1
    let storedTimes = JSON.parse(localStorage.getItem('times'))

    storedTimes.splice(index,1)
    localStorage.setItem('times',JSON.stringify(storedTimes))
    parentRow.remove()

    let timeTable = document.querySelectorAll('.table-container > table tr')

    for (let j=1; j < timeTable.length; j++) {
        timeTable[j].querySelectorAll('td')[1].innerText = j
    }
    updateStats()
}

let timerStart = function(event) {
    if (event.code == 'Space' && !isRunning) {
        timer.style.color = "black"
        const init = Date.now()
        isRunning = true
        interval = setInterval(() => {
            timer.innerHTML = (Math.round((Date.now()-init)/10)/100).toFixed(2)
        }, 10)
    } else if (event.code == 'Space' && isRunning) {
        isRunning = false
        updateTimeLog(Number(timer.innerHTML))
        return
    }
}

let timerStop = function(event) {
    if (event.code == 'Space' && isRunning) {
        clearInterval(interval)   
    } else if (event.code == 'Space' && !isRunning) {
        timer.style.color = "green"
    }
}

//Get first 3x3 scramble
getScramble()


// function logData() {
//     fetch("./assets/Ellis_solves.csv")
//         .then(response => response.text())
//         .then(data => {
//         // Split the data into an array of lines
//         var lines = data.split('\r\n');

//         // Loop through each line
//         lines = lines.map((line) => [Number(line.split(',')[1]),line.split(',')[2]])

//         for (let j=0; j<lines.length; j++) {
//             let kdata = processKPuzzle(lines[j][1]).then((value) => {
//                 lines[j].push(value)
//                 console.log(value.length)
//                 if (j == lines.length - 1) {
//                     lines = processDataForNN(lines)
//                     console.log(lines)

//                     trainNN(lines, 'EllisNet')
                
//                 }
//             })
//         }

//         })
//         .catch(error => console.log(error));
// }

// logData()


// Event Listeners
document.addEventListener('keyup', timerStart)
document.addEventListener('keydown', timerStop)
document.querySelector('#train').addEventListener('click', runTraining)
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('times')) {
        return
    }
    let myArr = JSON.parse(localStorage.getItem('times'))
    addTableData(myArr)
    updateStats()
})