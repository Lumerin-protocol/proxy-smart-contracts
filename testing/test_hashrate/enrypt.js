let EthCrypto = require('eth-crypto');
let web3 = require('web3')
web3 = new web3()




//signs and encrypts a message
let encryptMessage = async function(ip, port, username, privateKey, key) {
	let message = `${ip}|${port}|${username}`

	buffer = Buffer.from(key, "hex")
	keyUint = buffer.toJSON()["data"]

	let signature = EthCrypto.sign(
		privateKey,
		EthCrypto.hash.keccak256(message)
	)

	let payload = {
		message: message,
		signature
	}

	let encryptSignedMessage;
	await EthCrypto.encryptWithPublicKey(
		key,
		JSON.stringify(payload)
	).then(r => encryptSignedMessage = r)

	let encryptedString = EthCrypto.cipher.stringify(encryptSignedMessage)
	return encryptedString
}


//decrypts message and checks for valid signature

let decryptMessage = async function(message, key) {
	let encryptedMessage = EthCrypto.cipher.parse(message)
	let decryptedMessage
	await EthCrypto.decryptWithPrivateKey(
		key,
		encryptedMessage
	).then(r => decryptedMessage = r)
	decrypedPayload = JSON.parse(decryptedMessage)
	return decrypedPayload.message
}
module.exports.encrypt = encryptMessage
module.exports.decrypt = decryptMessage
