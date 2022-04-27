let fs = require('fs')

let Web3 = require('web3')
let web3 = new Web3()

let lmr_total = 100000

let assign_lmr = () => {
	//r = Math.floor(10*lmr_total*Math.random())
	let r = .01*lmr_total*Math.random()
	r = r.toFixed(8)
	lmr_total = lmr_total-r
	return r
}

//function to generate a new web3 keypair
let generate_keypair = () => {
	new_account = web3.eth.accounts.create()
	return  [ new_account.address, new_account.privateKey, assign_lmr() ]
	//return  { address: new_account.address, privkey: new_account.privateKey, value: assign_lmr() }
}


let generate_array = () => {
	let rows = []
	for (let i = 0; i < 640; i++) {
		a = generate_keypair()
		rows.push(a)
	}
	return rows
}

let write_to_csv = () => {
	f_name = "addresses.csv"
	var logger = fs.createWriteStream(f_name)
	a = generate_array()
	for (let row of a) {
		logger.write(`\n${row.join(',')}`)
	}
}

write_to_csv()

