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

function trainNN(trainingData) {
    const config = {
        binaryThresh: 0.5,
        hiddenLayers: [3], // array of ints for the sizes of the hidden layers in the network
        activation: 'sigmoid', // supported activation types: ['sigmoid', 'relu', 'leaky-relu', 'tanh'],
        leakyReluAlpha: 0.01, // supported for activation type 'leaky-relu'
    };
    
    // create a simple feed forward neural network with backpropagation
    const net = new brain.NeuralNetwork(config);
    net
        .trainAsync(trainingData, {log: true, iterations: 300})
        .then((res) => {
            localStorage.setItem('net', JSON.stringify(net.toFunction().toString()))
        })
        .catch((e) => {
            console.log(e)
        })
}

function runTraining() {
    // Get scramble & time data from local storage
    let myTrainingData = JSON.parse(localStorage.getItem('times'))

    // Pre-process data for use in NN
    let parsedTraningData = processDataForNN(myTrainingData)

    // Train NN on processed data
    trainNN(parsedTraningData)
}

async function getScramble() {
    // Set loading text
    let scrambleElem = document.getElementById('scramble')
    scrambleElem.innerText = "Loading..."

    // Get saved NN and make into function
    let net = JSON.parse(localStorage.getItem('net'))
    var myFunc = eval('(' + net + ')');

    // Get scramble and puzzle instance from cubing.js CDN
    let scramble = await randomScrambleForEvent("333");
    let kPuzzle = await puzzles['3x3x3']['kpuzzle']()

    // Turn scramble into array of piece info and pass into NN, saving value of difficulty
    let transformationData = kPuzzle.algToTransformation(scramble).transformationData
    let mergedArr = Object.values(transformationData).flatMap(pieceData => [...pieceData.orientation, ...pieceData.permutation])
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

let updateTimeLog = async function(time) {
    let kPuzzle = await puzzles['3x3x3']['kpuzzle']()
    let transformationData = kPuzzle.algToTransformation(scrambleElem.innerText).transformationData
    let mergedArr = Object.values(transformationData).flatMap(pieceData => [...pieceData.orientation, ...pieceData.permutation])

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
        newTime.innerText = arr[j-1][0]
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
    }
}

//Get first 3x3 scramble
getScramble()

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