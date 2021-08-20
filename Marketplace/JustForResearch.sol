
        function getNumTransactions(address inputAddress, uint switcher) public view returns (uint)
        {

            if (switcher == 0) return (escrow_purchaserDatabase[inputAddress].length);

            else if (switcher == 1) return (escrow_sellerDatabase[inputAddress].length);

            else return (escrowDatabase[inputAddress].length);
        }

        
        function getTransaction(address inputAddress, uint switcher, uint ID) public view returns (address, address, address, uint, bytes32, uint, bytes32)

        {
            bytes32 status;
            Escrow memory currentEscrow;
            if (switcher == 0)
            {
                currentEscrow = escrow_purchaserDatabase[inputAddress][ID];
                status = getEscrowStatus(inputAddress, ID);
            } 
            
            else if (switcher == 1)

            {  
                currentEscrow = escrow_purchaserDatabase[escrow_sellerDatabase[inputAddress][ID].escrow_purchaser][escrow_sellerDatabase[inputAddress][ID].escrow_purchaser_nounce];
                status = getEscrowStatus(currentEscrow.escrow_purchaser, escrow_sellerDatabase[inputAddress][ID].escrow_purchaser_nounce);
            }

                        
            else if (switcher == 2)
            
            {        
                currentEscrow = escrow_purchaserDatabase[escrowDatabase[inputAddress][ID].escrow_purchaser][escrowDatabase[inputAddress][ID].escrow_purchaser_nounce];
                status = getEscrowStatus(currentEscrow.escrow_purchaser, escrowDatabase[inputAddress][ID].escrow_purchaser_nounce);
            }

            return (currentEscrow.escrow_purchaser, currentEscrow.escrow_seller, currentEscrow.escrow_mgmt, currentEscrow.amount, status, currentEscrow.escrow_fee, currentEscrow.notes);
        }   


        function getgetEscrowHistory_Buyer(address escrow_purchaserAddress, uint startID, uint numToLoad) public view returns (address[], address[],uint[], bytes32[]){


            uint length;
            if (escrow_purchaserDatabase[escrow_purchaserAddress].length < numToLoad)
                length = escrow_purchaserDatabase[escrow_purchaserAddress].length;
            
            else 
                length = numToLoad;
            
            address[] memory escrow_sellers = new address[](length);
            address[] memory escrow_mgmts = new address[](length);
            uint[] memory amounts = new uint[](length);
            bytes32[] memory statuses = new bytes32[](length);
           
            for (uint i = 0; i < length; i++)
            {
  
                escrow_sellers[i] = (escrow_purchaserDatabase[escrow_purchaserAddress][startID + i].escrow_seller);
                escrow_mgmts[i] = (escrow_purchaserDatabase[escrow_purchaserAddress][startID + i].escrow_mgmt);
                amounts[i] = (escrow_purchaserDatabase[escrow_purchaserAddress][startID + i].amount);
                statuses[i] = getEscrowStatus(escrow_purchaserAddress, startID + i);
            }
            
            return (escrow_sellers, escrow_mgmts, amounts, statuses);
        }


                 
        function getgetEscrowHistory_Seller(address inputAddress, uint startID , uint numToLoad) public view returns (address[], address[], uint[], bytes32[]){

            address[] memory escrow_purchasers = new address[](numToLoad);
            address[] memory escrows = new address[](numToLoad);
            uint[] memory amounts = new uint[](numToLoad);
            bytes32[] memory statuses = new bytes32[](numToLoad);

            for (uint i = 0; i < numToLoad; i++)
            {
                if (i >= escrow_sellerDatabase[inputAddress].length)
                    break;
                escrow_purchasers[i] = escrow_sellerDatabase[inputAddress][startID + i].escrow_purchaser;
                escrows[i] = escrow_purchaserDatabase[escrow_purchasers[i]][escrow_sellerDatabase[inputAddress][startID +i].escrow_purchaser_nounce].escrow_mgmt;
                amounts[i] = escrow_purchaserDatabase[escrow_purchasers[i]][escrow_sellerDatabase[inputAddress][startID + i].escrow_purchaser_nounce].amount;
                statuses[i] = getEscrowStatus(escrow_purchasers[i], escrow_sellerDatabase[inputAddress][startID + i].escrow_purchaser_nounce);
            }
            return (escrow_purchasers, escrows, amounts, statuses);
        }

        function getEscrowHistory(address inputAddress, uint startID, uint numToLoad) public view returns (address[], address[], uint[], bytes32[]){
        
            address[] memory escrow_purchasers = new address[](numToLoad);
            address[] memory escrow_sellers = new address[](numToLoad);
            uint[] memory amounts = new uint[](numToLoad);
            bytes32[] memory statuses = new bytes32[](numToLoad);

            for (uint i = 0; i < numToLoad; i++)
            {
                if (i >= escrowDatabase[inputAddress].length)
                    break;
                escrow_purchasers[i] = escrowDatabase[inputAddress][startID + i].escrow_purchaser;
                escrow_sellers[i] = escrow_purchaserDatabase[escrow_purchasers[i]][escrowDatabase[inputAddress][startID +i].escrow_purchaser_nounce].escrow_seller;
                amounts[i] = escrow_purchaserDatabase[escrow_purchasers[i]][escrowDatabase[inputAddress][startID + i].escrow_purchaser_nounce].amount;
                statuses[i] = getEscrowStatus(escrow_purchasers[i], escrowDatabase[inputAddress][startID + i].escrow_purchaser_nounce);
            }
            return (escrow_purchasers, escrow_sellers, amounts, statuses);
    }
