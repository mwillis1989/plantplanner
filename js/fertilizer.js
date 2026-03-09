const fertBlock = document.getElementById("calcBlock2");

fertBlock.innerHTML = `

<details>
<summary>Fertilizer Value Calculator</summary>

<label>US Tons Dry Matter</label>
<input id="fvUsTons" type="number">

<label>Fertilizer %</label>
<input id="fvPercent" type="number">

<button onclick="calculateFertilizerValue()">Calculate</button>

<div id="fvResult" class="result"></div>

</details>

<details>
<summary>PPM → lb Nutrient</summary>

<label>PPM</label>
<input id="ppmInput">

<button onclick="convertPPM()">Convert</button>

<div id="ppmResult" class="result"></div>

</details>

<details>
<summary>Plant Number Calculator</summary>

<label>Area (hectares)</label>
<input id="pnArea">

<label>Plants per hectare</label>
<input id="pnDensity">

<button onclick="calcPlants()">Calculate</button>

<div id="pnResult" class="result"></div>

</details>

`;

function calculateFertilizerValue(){

const tons=parseFloat(document.getElementById("fvUsTons").value);
const percent=parseFloat(document.getElementById("fvPercent").value);

const lbs=tons*2000*(percent/100);

document.getElementById("fvResult").innerText=lbs.toFixed(2)+" lbs nutrient";

}

function convertPPM(){

const ppm=parseFloat(document.getElementById("ppmInput").value);

const lb=ppm/1200;

document.getElementById("ppmResult").innerText=lb.toFixed(4)+" lb";

}

function calcPlants(){

const area=parseFloat(document.getElementById("pnArea").value);
const density=parseFloat(document.getElementById("pnDensity").value);

const plants=area*density;

document.getElementById("pnResult").innerText=plants.toFixed(0)+" plants";

}
