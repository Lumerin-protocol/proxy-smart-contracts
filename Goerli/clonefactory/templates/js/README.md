# contracts-js

**contracts-js** is a library that provides a convenient way to interact with blockchain contracts in Javascript/Typescript. It also includes typings for all contract related functions that auto-generated from source ABI files when smart-contract changes.

## Installation

For now library is not available at npm. Use git url:

`$ yarn add git+ssh://github.com/Lumerin-protocol/contracts-js.git#0.0.7`

## Usage

```
import  Web3  from  "web3";
import { CloneFactory, Implementation, Lumerin } from  "contracts-js";

const  web3 = new  Web3(Web3.givenProvider || "ws://localhost:8545");

const  cf = CloneFactory(web3, "CLONE_FACTORY_ADDRESS");
const  list = await  cf.methods.getContractList().call();

const  impl = Implementation(web3, "IMPLEMENTATION_ADDRESS");
const  total = await  impl.methods.contractTotal().call();

const  lum = Lumerin(web3, "LUMERIN_ADDRESS");
const  call = await  lum.methods.balanceOf("account").call();
```
