<h3>Water & H₂O₂ Tools</h3>

<details>
<summary>Hydrogen Peroxide Dilution</summary>

<label>Water Volume (L)</label>
<input id="waterVol">

<label>Target ppm</label>
<input id="targetPPM">

<label>% Peroxide</label>
<input id="peroxidePercent">

<button onclick="peroxide()">Calculate</button>

<div id="peroxideResult"></div>

</details>


<details>
<summary>Irrigation Water Requirement</summary>

<label>Area (m²)</label>
<input id="waterArea">

<label>Litres per m²</label>
<input id="waterRate">

<button onclick="waterUse()">Calculate</button>

<div id="waterResult"></div>

</details>


<details>
<summary>Annual Water Storage</summary>

<label>Tank Size (m³)</label>
<input id="storage">

<label>Daily Use</label>
<input id="days">

<button onclick="waterStorage()">Calculate</button>

<div id="storageResult"></div>

</details>


<script>

function peroxide(){
peroxideResult.innerText=((targetPPM.value*waterVol.value)/(peroxidePercent.value*10)).toFixed(2)
}

function waterUse(){
waterResult.innerText=(waterArea.value*waterRate.value).toFixed(0)
}

function waterStorage(){
storageResult.innerText=(storage.value/days.value).toFixed(2)+" days"
}

</script>
