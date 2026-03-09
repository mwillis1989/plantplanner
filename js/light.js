document.addEventListener("DOMContentLoaded", function(){

const block = document.getElementById("calcBlock5");
if(!block) return;

block.innerHTML = `

<details>
<summary>Lux → PPFD</summary>

<label>Lux</label>
<input id="luxInput">

<button onclick="luxToPPFD()">Convert</button>

<div id="ppfdResult" class="result"></div>

</details>

<details>
<summary>Micromoles → Moles</summary>

<label>µmol</label>
<input id="umolInput">

<button onclick="umolToMol()">Convert</button>

<div id="molResult" class="result"></div>

</details>

`;

});

function luxToPPFD(){

const lux=parseFloat(document.getElementById("luxInput").value);

const ppfd=lux/54;

document.getElementById("ppfdResult").innerText=ppfd.toFixed(2)+" µmol/m²/s";

}

function umolToMol(){

const umol=parseFloat(document.getElementById("umolInput").value);

const mol=umol/1000000;

document.getElementById("molResult").innerText=mol+" mol";

}
