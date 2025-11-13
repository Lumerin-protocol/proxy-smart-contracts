## Methods
| **Symbol** | **Meaning**                                                                              |
| :--------: | :--------------------------------------------------------------------------------------- |
|    **◯**   | Execution gas for this method does not include intrinsic gas overhead                    |
|    **△**   | Cost was non-zero but below the precision setting for the currency display (see options) |

|                                         |     Min |       Max |     Avg | Calls | usd avg |
| :-------------------------------------- | ------: | --------: | ------: | ----: | ------: |
| **BTCPriceOracleMock**                  |         |           |         |       |         |
|        *setPrice*                       |       - |         - |  31,786 |     2 |       - |
| **Futures**                             |         |           |         |       |         |
|        *addMargin*                      |  59,261 |    76,373 |  75,547 |    89 |       - |
|     **◯**  *balanceOf*                  |       - |         - |   7,672 |    62 |       - |
|     **◯**  *breachPenaltyRatePerDay*    |       - |         - |   7,273 |     1 |       - |
|        *closeDelivery*                  | 118,732 |   120,972 | 120,373 |    13 |       - |
|        *closeOrder*                     |       - |         - |  84,080 |     3 |       - |
|        *createOrder*                    | 141,264 | 1,497,433 | 599,514 |   252 |       - |
|     **◯**  *decimals*                   |       - |         - |   7,271 |     1 |       - |
|     **◯**  *deliveryDurationDays*       |       - |         - |   7,332 |     3 |       - |
|     **◯**  *deliveryIntervalDays*       |       - |         - |   7,333 |     6 |       - |
|        *depositDeliveryPayment*         |  72,964 |   105,341 |  80,140 |    10 |       - |
|        *depositReservePool*             |       - |         - | 110,552 |     1 |       - |
|     **◯**  *firstFutureDeliveryDate*    |       - |         - |   7,252 |     6 |       - |
|     **◯**  *futureDeliveryDatesCount*   |       - |         - |   7,288 |     1 |       - |
|     **◯**  *getDeliveryDates*           |  11,791 |    14,437 |  12,938 |    10 |       - |
|     **◯**  *getMarketPrice*             |       - |         - |  35,444 |    38 |       - |
|     **◯**  *getMinMargin*               |  10,158 |   108,457 |  70,256 |    30 |       - |
|     **◯**  *getMinMarginForPosition*    |  42,570 |    42,653 |  42,591 |     4 |       - |
|     **◯**  *getOrderById*               |       - |         - |  17,369 |     8 |       - |
|     **◯**  *getPositionById*            |       - |         - |  22,048 |     9 |       - |
|     **◯**  *hashrateOracle*             |       - |         - |   7,293 |     1 |       - |
|     **◯**  *liquidationMarginPercent*   |       - |         - |   7,353 |     1 |       - |
|        *marginCall*                     |  88,449 |   207,384 | 142,120 |    19 |       - |
|     **◯**  *MAX_ORDERS_PER_PARTICIPANT* |       - |         - |   5,184 |     1 |       - |
|     **◯**  *name*                       |       - |         - |   8,340 |     1 |       - |
|     **◯**  *orderFee*                   |       - |         - |   7,276 |     1 |       - |
|        *removeMargin*                   |  61,832 |   137,051 |  87,810 |     5 |       - |
|        *setFutureDeliveryDatesCount*    |       - |         - |  33,807 |     6 |       - |
|        *setOrderFee*                    |       - |         - |  51,815 |     1 |       - |
|     **◯**  *speedHps*                   |       - |         - |   7,276 |     1 |       - |
|     **◯**  *symbol*                     |       - |         - |   8,339 |     1 |       - |
|     **◯**  *token*                      |       - |         - |   7,337 |     1 |       - |
|     **◯**  *validatorAddress*           |       - |         - |   7,361 |     1 |       - |
|        *withdrawDeliveryPayment*        |  51,286 |    58,233 |  52,444 |     6 |       - |
| **HashrateOracle**                      |         |           |         |       |         |
|     **◯**  *getHashesForBTC*            |       - |         - |  11,936 |     8 |       - |
|        *setHashesForBTC*                |  39,687 |    73,899 |  43,496 |     9 |       - |
|        *setTTL*                         |       - |         - |  73,659 |     1 |       - |
| **Lumerin**                             |         |           |         |       |         |
|        *transfer*                       |  53,718 |    53,730 |  53,728 |     5 |       - |
| **USDCMock**                            |         |           |         |       |         |
|        *approve*                        |       - |         - |  46,683 |     5 |       - |
|     **◯**  *balanceOf*                  |       - |         - |   2,562 |     3 |       - |
|     **◯**  *decimals*                   |       - |         - |     177 |     1 |       - |
|     **◯**  *symbol*                     |       - |         - |   3,216 |     1 |       - |
|        *transfer*                       |  51,584 |    51,596 |  51,594 |     5 |       - |

## Deployments
|                        |     Min |    Max  |       Avg | Block % | usd avg |
| :--------------------- | ------: | ------: | --------: | ------: | ------: |
| **BTCPriceOracleMock** |       - |       - |   296,627 |     1 % |       - |
| **ERC1967Proxy**       | 180,114 | 376,660 |   278,387 |   0.9 % |       - |
| **Futures**            |       - |       - | 4,484,372 |  14.9 % |       - |
| **HashrateOracle**     |       - |       - | 1,007,394 |   3.4 % |       - |
| **Lumerin**            |       - |       - | 1,001,726 |   3.3 % |       - |
| **Multicall3**         |       - |       - |   763,305 |   2.5 % |       - |
| **USDCMock**           |       - |       - |   557,643 |   1.9 % |       - |

## Solidity and Network Config
| **Settings**        | **Value**  |
| ------------------- | ---------- |
| Solidity: version   | 0.8.18     |
| Solidity: optimized | true       |
| Solidity: runs      | 200        |
| Solidity: viaIR     | false      |
| Block Limit         | 30,000,000 |
| Gas Price           | -          |
| Token Price         | -          |
| Network             | ETHEREUM   |
| Toolchain           | hardhat    |

