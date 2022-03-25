// Web3 Interaction for Token Drop Contract
const Web3 = require("web3"),
      theABIImport = require("fs").readFileSync('ABI.json'),
      ABIJSON = JSON.parse(theABIImport),
      web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545")),
      lumerin = new web3.eth.Contract(ABIJSON, "0xc"),
      sender = "0x9",
      receiver = "0x9",
      privKey ="0x0";

/* For Dev Fun...
lumerin.methods.owner().call().then(console.log);
lumerin.methods.whitelist(sender).call().then(console.log);
*/

const methodClaim = lumerin.methods.Claim(),
      claimABI = methodClaim.encodeABI(),
      tx = {
        from: sender,
        to: sender,
        gas: 2000000,
        data: claimABI,
      },
      account = web3.eth.accounts.privateKeyToAccount(privKey);
      console.log('Lets be sure of the account we\'re using...\n'+account);

web3.eth.accounts.signTransaction(tx, privKey).then(signed => {
  const letsgo = web3.eth
    .sendSignedTransaction(signed.rawTransaction)
    .on('confirmation', (confirmationNumber, receipt) => {
      console.log('=> confirmation: ' + confirmationNumber);
    })
    .on('transactionHash', hash => {
      console.log('=> hash');
      console.log(hash);
    })
    .on('receipt', receipt => {
      console.log('=> reciept');
      console.log(receipt);
    })
    .on('error', console.error);
});
