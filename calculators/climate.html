<h3>Climate & Light Calculators</h3>

<details>
<summary>DLI ↔ PPFD Converter</summary>

<label>PPFD (µmol/m²/s)</label>
<input id="ppfd">

<label>Photoperiod (hrs)</label>
<input id="hrs">

<button onclick="calcDLI()">Calculate</button>

<div id="dliResult"></div>

</details>


<details>
<summary>DLI for Electric Light</summary>

<label>Light Intensity</label>
<input id="lightIntensity">

<label>Photoperiod</label>
<input id="photoperiod">

<button onclick="calcElectricDLI()">Calculate</button>

<div id="electricResult"></div>

</details>


<details>
<summary>Estimate DLI from Peak Sunlight</summary>

<label>Peak PPFD</label>
<input id="sunPPFD">

<label>Day Length (hrs)</label>
<input id="sunHours">

<button onclick="calcSunDLI()">Calculate</button>

<div id="sunResult"></div>

</details>


<details>
<summary>VPD Calculator</summary>

<label>Temperature (°C)</label>
<input id="vpdTemp">

<label>Relative Humidity (%)</label>
<input id="vpdRH">

<button onclick="calcVPD()">Calculate</button>

<div id="vpdResult"></div>

</details>


<details>
<summary>DLI vs Photoperiod</summary>

<label>PPFD</label>
<input id="graphPPFD">

<button onclick="dliGraph()">Generate</button>

<div id="graphResult"></div>

</details>


<script>

function calcDLI(){
const d=(ppfd.value*hrs.value*3600)/1e6
dliResult.innerText=d.toFixed(2)+" mol/m²/day"
}

function calcElectricDLI(){
const d=(lightIntensity.value*photoperiod.value*3600)/1e6
electricResult.innerText=d.toFixed(2)
}

function calcSunDLI(){
const d=(sunPPFD.value*sunHours.value*3600)/1e6
sunResult.innerText=d.toFixed(2)
}

function calcVPD(){

const t=parseFloat(vpdTemp.value)
const rh=parseFloat(vpdRH.value)

const es=0.6108*Math.exp((17.27*t)/(t+237.3))
const ea=(rh/100)*es

vpdResult.innerText=(es-ea).toFixed(2)+" kPa"

}

function dliGraph(){

const ppfd=parseFloat(graphPPFD.value)

let text=""

for(let h=8;h<=20;h+=2){

const d=(ppfd*h*3600)/1e6

text+=h+" hrs → "+d.toFixed(2)+" mol/m²/day\n"

}

graphResult.innerText=text

}

</script>
