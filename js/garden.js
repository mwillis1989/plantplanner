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

<label>Percent</label>
<input id="mixP">

<label>Weight</label>
<input id="mixW">

<button onclick="fertMix()">Calculate</button>

<div id="mixResult" class="result"></div>

</details>


<details>
<summary>Cost per kg Nutrient</summary>

<label>Bag Cost</label>
<input id="bagCost">

<label>Bag Weight</label>
<input id="bagWeight">

<label>Nutrient %</label>
<input id="nutPercent">

<button onclick="costKg()">Calculate</button>

<div id="costResult" class="result"></div>

</details>


<details>
<summary>Cost of Nutrient Application Rate</summary>

<label>Bag Price</label>
<input id="nutPrice">

<label>Bag Weight</label>
<input id="nutWeight">

<label>Nutrient %</label>
<input id="nutPercent2">

<button onclick="nutCost()">Calculate</button>

<div id="nutCostResult" class="result"></div>

</details>


<details>
<summary>Fertilizer Total Weights</summary>

<label>Total Weight</label>
<input id="fertWeight">

<label>Nutrient %</label>
<input id="fertPercent">

<button onclick="fertWeightCalc()">Calculate</button>

<div id="fertWeightResult" class="result"></div>

</details>

`;

});


function fertValue(){
fertResult.innerText=(tons.value*2000*(percent.value/100)).toFixed(2)+" lb nutrient";
}

function fertMix(){
mixResult.innerText=(mixW.value*(mixP.value/100)).toFixed(2);
}

function costKg(){
const nutrient=bagWeight.value*(nutPercent.value/100);
costResult.innerText=(bagCost.value/nutrient).toFixed(2)+" per kg";
}

function nutCost(){
const nutrient=nutWeight.value*(nutPercent2.value/100);
nutCostResult.innerText=(nutPrice.value/nutrient).toFixed(2);
}

function fertWeightCalc(){
fertWeightResult.innerText=(fertWeight.value*(fertPercent.value/100)).toFixed(2);
}
