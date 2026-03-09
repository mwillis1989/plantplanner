document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock3")

block.innerHTML=`

<details>
<summary>Fertilizer Value</summary>

<label>US tons</label>
<input id="tons">

<label>%</label>
<input id="percent">

<button onclick="fertValue()">Calculate</button>

<div id="fertResult" class="result"></div>

</details>

<details>
<summary>Fertilizer Mixture</summary>

<label>%</label>
<input id="mixP">

<label>Weight</label>
<input id="mixW">

<button onclick="fertMix()">Calculate</button>

<div id="mixResult" class="result"></div>

</details>

<details>
<summary>Cost per kg Nutrient</summary>

<label>Bag cost</label>
<input id="bagCost">

<label>Bag weight</label>
<input id="bagWeight">

<label>% nutrient</label>
<input id="nutPercent">

<button onclick="costKg()">Calculate</button>

<div id="costResult" class="result"></div>

</details>

`

})

function fertValue(){
fertResult.innerText=(tons.value*2000*(percent.value/100)).toFixed(2)+" lb nutrient"
}

function fertMix(){
mixResult.innerText=(mixW.value*(mixP.value/100)).toFixed(2)
}

function costKg(){

const nutrient=bagWeight.value*(nutPercent.value/100)

costResult.innerText=(bagCost.value/nutrient).toFixed(2)+" per kg"

}
