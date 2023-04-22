// Import KPuzzle and Cubing.js random scramble dependencies
import { randomScrambleForEvent } from "https://cdn.cubing.net/js/cubing/scramble";
import { puzzles } from "https://cdn.cubing.net/js/cubing/puzzles"

const timer = document.querySelector("#timer")
const config = {}
let isRunning = false
var interval = null
let arr = []
let tableBody = document.getElementsByTagName('tbody')[0]
let scrambleElem = document.getElementById('scramble')
let difficultyPreference = Number(document.getElementById('myRange').value)/100
let difficultyLabel = document.querySelector('.slidecontainer label')
let net = new brain.NeuralNetwork(config);

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

function prepTestData() {

    fetch("./assets/Ellis_test.csv")
        .then(response => response.text())
        .then(data => {
        // Split the data into an array of lines
        var lines = data.split('\r\n');

        // Loop through each line
        lines = lines.map((line) => [Number(line.split(',')[1]),line.split(',')[2]])

        for (let j=0; j<lines.length; j++) {
            let kdata = processKPuzzle(lines[j][1]).then((value) => {
                lines[j].push(value)
                if (j == lines.length - 1) {
                    lines = processDataForNN(lines)
                    console.log("testing")
                    console.log(net)
                    console.log(net.test(lines))
                }
            })
        }

        })
        .catch(error => console.log(error));
}

function trainNN(trainingData, netName) {
    const config = {
        binaryThresh: 0.5,
        hiddenLayers: [15,6], // array of ints for the sizes of the hidden layers in the network
        activation: 'tanh', // supported activation types: ['sigmoid', 'relu', 'leaky-relu', 'tanh'],
        leakyReluAlpha: 0.01, // supported for activation type 'leaky-relu'
        learningRate: 0.3
    };
    
    // create a simple feed forward neural network with backpropagation
    net = new brain.NeuralNetwork(config);
    net
        .trainAsync(trainingData, {log: true, iterations: 1500, logPeriod: 50})
        .then((res) => {
            localStorage.setItem(netName, JSON.stringify(net.toFunction().toString()))
            localStorage.setItem('EllisNetObj', JSON.stringify(net.toJSON()))
            console.log("trained")
            prepTestData()
        
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
    let difficultyPreference = Number(document.getElementById('myRange').value)/100
    
    // Set loading text
    let scrambleElem = document.getElementById('scramble')
    scrambleElem.innerText = "Loading..."

    // Get saved NN and make into function
    let netLS = JSON.parse(localStorage.getItem('EllisNet'))
    var myFunc = eval('(' + netLS + ')');

    // Get scramble and puzzle instance from cubing.js CDN
    let scramble = await randomScrambleForEvent("333");
    let kPuzzle = await puzzles['3x3x3']['kpuzzle']()

    // Turn scramble into array of piece info and pass into NN, saving value of difficulty
    let transformationData = kPuzzle.algToTransformation(scramble).transformationData
    let eo = transformationData.EDGES.orientation.map(x => Math.max(...transformationData.EDGES.orientation) === 0 ? 0 : x/Math.max(...transformationData.EDGES.orientation))
    let ep = transformationData.EDGES.permutation.map(x => Math.max(...transformationData.EDGES.permutation) === 0 ? 0 : x/Math.max(...transformationData.EDGES.permutation))
    let co = transformationData.CORNERS.orientation.map(x => Math.max(...transformationData.CORNERS.orientation) === 0 ? 0 : x/Math.max(...transformationData.CORNERS.orientation))
    let cp = transformationData.CORNERS.permutation.map(x => Math.max(...transformationData.CORNERS.permutation) === 0 ? 0 : x/Math.max(...transformationData.CORNERS.permutation))
    let mergedArr = [...eo, ...ep, ...co, ...cp]
    let scrambleDifficulty = net.run(mergedArr)[0]
    console.log(scrambleDifficulty)

    // Check if scramble hard enough and log to screen

    if (difficultyPreference >.5) {
        if (scrambleDifficulty > difficultyPreference) {
            scrambleElem.innerText = scramble
        } else {
            getScramble()
        }
    } else if (difficultyPreference < .5) {
        if (scrambleDifficulty < difficultyPreference) {
            scrambleElem.innerText = scramble
        } else {
            getScramble()
        }
    } else {
        if (scrambleDifficulty < .9999) {
            scrambleElem.innerText = scramble
        } else {
            getScramble()
        }
    }
    return
}

async function processKPuzzle(scram) {
    let kPuzzle = await puzzles['3x3x3']['kpuzzle']()
    let transformationData = kPuzzle.algToTransformation(scram).transformationData
    let eo = transformationData.EDGES.orientation.map(x => Math.max(...transformationData.EDGES.orientation) === 0 ? 0 : x/Math.max(...transformationData.EDGES.orientation))
    let ep = transformationData.EDGES.permutation.map(x => Math.max(...transformationData.EDGES.permutation) === 0 ? 0 : x/Math.max(...transformationData.EDGES.permutation))
    let co = transformationData.CORNERS.orientation.map(x => Math.max(...transformationData.CORNERS.orientation) === 0 ? 0 : x/Math.max(...transformationData.CORNERS.orientation))
    let cp = transformationData.CORNERS.permutation.map(x => Math.max(...transformationData.CORNERS.permutation) === 0 ? 0 : x/Math.max(...transformationData.CORNERS.permutation))
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
    let bestTimes = document.getElementById('best-avg').querySelectorAll('tr td:nth-child(2)')
    let justTimes = data.map(row => row[0])
    let currentStats = [avgLastNofArr(justTimes,3),avgLastNofArr(justTimes,5),avgLastNofArr(justTimes,12)]
    for (let k=0; k < currentTds.length; k++) {
        currentTds[k].innerText = typeof currentStats[k] == 'number' ? currentStats[k].toFixed(2) : '--'

        if (bestTimes[k].innerText == '--' || Number(currentTds[k].innerText) < Number(bestTimes[k].innerText)) {
            bestTimes[k].innerText = currentTds[k].innerText
        }
    }
}

function avgLastNofArr(arr, n) {
    if (arr.length < n) {
        return '--'
    }
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
        btnSpan.innerText = 'X'
        closeBtnCell.addEventListener('click', handleDelete)
        closeBtnCell.appendChild(btnSpan)
        newRow.append(closeBtnCell, newSolveNum, newTime)
        newSolveNum.innerText = arr.length == 1 ? lastEntry + 1 : j
        newTime.innerText = arr[j-1][0].toFixed(2)
        tableBody.appendChild(newRow)
    }
}

let handleDelete = function(event) {
    let parentRow = event.currentTarget.parentElement
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
    iterateHistorical()
}

let iterateHistorical = function() {
    let timeTableRows = document.querySelectorAll('.table-container tr > td:nth-child(3)')
    let arr = [...timeTableRows].map((solveTimeElem) => Number(solveTimeElem.innerText))
    console.log(arr)

    let bo3 = 100000
    let ao5 = 100000
    let ao12 = 100000

    if (arr.length >= 3) {
        for (let i=0; i < arr.length-2; i++) {
            let currentThree = (arr[i]+arr[i+1]+arr[i+2])/3
            bo3 = currentThree < bo3 ? currentThree : bo3
        }
    }
    if (arr.length >= 5) {
        for (let i=0; i < arr.length-4; i++) {
            let tempArr = arr.slice(i,i+5)
            tempArr.splice(tempArr.indexOf(Math.max(...tempArr)),1)
            tempArr.splice(tempArr.indexOf(Math.min(...tempArr)),1)
            let currentFive = tempArr.reduce((total,current) => total + current)/tempArr.length
            ao5 = currentFive < ao5 ? currentFive : ao5
        }
    }
    if (arr.length >= 12) {
        for (let i=0; i < arr.length-11; i++) {
            let tempArr = arr.slice(i,i+12)
            tempArr.splice(tempArr.indexOf(Math.max(...tempArr)),1)
            tempArr.splice(tempArr.indexOf(Math.min(...tempArr)),1)
            let currentTwelve = tempArr.reduce((total,current) => total + current)/tempArr.length
            ao12 = currentTwelve < ao12 ? currentTwelve : ao12
        }
    }

    let bestTimes = document.getElementById('best-avg').querySelectorAll('tr td:nth-child(2)')
    bestTimes[0].innerText = bo3 === 100000 ? '--' : Number(bo3).toFixed(2)
    bestTimes[1].innerText = ao5 === 100000 ? '--' : Number(ao5).toFixed(2)
    bestTimes[2].innerText = ao12 === 100000 ? '--' : Number(ao12).toFixed(2)
    return
}

let handleSpaceUp = function(event) {
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

let handleSpaceDown = function(event) {
    if (event.code == 'Space') {
        isRunning ? clearInterval(interval) : timer.style.color = 'green'
    }   
}

function logData() {

    fetch("./assets/Ellis_solves.csv")
        .then(response => response.text())
        .then(data => {
        // Split the data into an array of lines
        var lines = data.split('\r\n');

        // Loop through each line
        lines = lines.map((line) => [Number(line.split(',')[1]),line.split(',')[2]])

        for (let j=0; j<lines.length; j++) {
            let kdata = processKPuzzle(lines[j][1]).then((value) => {
                lines[j].push(value)
                if (j == lines.length - 1) {
                    lines = processDataForNN(lines)
                    console.log(lines)

                    trainNN(lines, 'EllisNet')
                
                }
            })
        }

        })
        .catch(error => console.log(error));
}

// logData()

// Event Listeners
document.addEventListener('keyup', handleSpaceUp)
document.addEventListener('keydown', handleSpaceDown)
// document.querySelector('#train').addEventListener('click', runTraining)
document.getElementById('myRange').addEventListener('change', () => {
    getScramble()
    let localMax = Number(document.getElementById('myRange').max)
    let localMin = Number(document.getElementById('myRange').min)

    difficultyPreference = Number(document.getElementById('myRange').value)
    let labelOutput = Math.round((difficultyPreference-localMin)/(localMax-localMin)*100)
    difficultyLabel.innerText = "Difficulty: " + labelOutput
})
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('times')) {
        return
    }
    let myArr = JSON.parse(localStorage.getItem('times'))
    addTableData(myArr)
    updateStats()

    fetch("./assets/js/net.json")
    .then(response => {
        return response.json()
    })
    .then(data => {
        net.fromJSON(data)
        console.log(net)
        getScramble()
    })
})

