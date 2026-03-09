document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock2");
if(!block) return;

block.innerHTML=`

<details>
<summary>Fertilizer Value Calculator</summary>

<label>US Tons Dry Matter</label>
<input id="tons">

<label>Fertilizer %</label>
<input id="percent">

<button onclick="fertValue()">Calculate</button>

<div id="fertResult" class="result"></div>

</details>


<details>
<summary>Fertilizer Mixture Calculator</summary>

<label>Fertilizer %</label>
<input id="mixPercent">

<label>Weight (kg)</label>
<input id="mixWeight">

<button onclick="fertMix()">Calculate</button>

<div id="mixResult" class="result"></div>

</details>


<details>
<summary>Plant Number Calculator</summary>

<label>Area (ha)</label>
<input id="plantArea">

<label>Plants / ha</label>
<input id="plantDensity">

<button onclick="calcPlants()">Calculate</button>

<div id="plantResult" class="result"></div>

</details>


<details>
<summary>PPM → lb Nutrient</summary>

<label>PPM</label>
<input id="ppm">

<button onclick="ppmToLb()">Convert</button>

<div id="ppmResult" class="result"></div>

</details>

`;

});

function fertValue(){
const lbs=tons.value*2000*(percent.value/100);
fertResult.innerText=lbs.toFixed(2)+" lbs nutrient";
}

function fertMix(){
const pure=mixWeight.value*(mixPercent.value/100);
mixResult.innerText=pure.toFixed(2)+" kg nutrient";
}

function calcPlants(){
plantResult.innerText=(plantArea.value*plantDensity.value).toFixed(0)+" plants";
}

function ppmToLb(){
ppmResult.innerText=(ppm.value/1200).toFixed(4)+" lb";
}
