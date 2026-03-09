<h3>General Conversions</h3>

<details>
<summary>Feet → Metres</summary>

<input id="ft">
<button onclick="ftMeters()">Convert</button>

<div id="mResult"></div>

</details>


<details>
<summary>Pounds → Kilograms</summary>

<input id="lb">
<button onclick="lbKg()">Convert</button>

<div id="kgResult"></div>

</details>


<details>
<summary>Gallons → Litres</summary>

<input id="gal">
<button onclick="galL()">Convert</button>

<div id="lResult"></div>

</details>


<details>
<summary>Temperature °F ↔ °C</summary>

<input id="f">
<button onclick="fC()">Convert</button>

<div id="tempResult"></div>

</details>


<script>

function ftMeters(){mResult.innerText=(ft.value*0.3048).toFixed(2)}
function lbKg(){kgResult.innerText=(lb.value*0.453592).toFixed(2)}
function galL(){lResult.innerText=(gal.value*3.78541).toFixed(2)}
function fC(){tempResult.innerText=((f.value-32)*5/9).toFixed(2)}

</script>
