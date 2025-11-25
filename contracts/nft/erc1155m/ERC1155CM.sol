//SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import {ERC1155M} from "./ERC1155M.sol";
import {ERC1155MStorage} from "./ERC1155MStorage.sol";
import {MintStageInfo1155} from "../../common/Structs.sol";
import {AuthorizedMinterControl} from "../../common/AuthorizedMinterControl.sol";
import {LAUNCHPAD_MINT_FEE_RECEIVER} from "../../utils/Constants.sol";
import {CreatorTokenBase} from "@limitbreak/creator-token-standards/src/utils/CreatorTokenBase.sol";
import {AutomaticValidatorTransferApproval} from
    "@limitbreak/creator-token-standards/src/utils/AutomaticValidatorTransferApproval.sol";
import {ICreatorToken} from "@limitbreak/creator-token-standards/src/interfaces/ICreatorToken.sol";
import {TOKEN_TYPE_ERC1155} from "@limitbreak/permit-c/Constants.sol";
/// @title ERC1155CM
/// @notice An ERC1155 contract with multi-stage minting, royalties, authorized minters, and Creator Token functionality
/// @dev Extends ERC1155C with ERC1155M functionality

contract ERC1155CM is ERC1155M, CreatorTokenBase, AutomaticValidatorTransferApproval {
    /*==============================================================
    =                          CONSTRUCTOR                         =
    ==============================================================*/

    constructor(
        string memory collectionName,
        string memory collectionSymbol,
        string memory uri,
        uint256[] memory maxMintableSupply,
        uint256[] memory globalWalletLimit,
        address mintCurrency,
        address fundReceiver,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator,
        uint256 mintFee
    )
        ERC1155M(
            collectionName,
            collectionSymbol,
            uri,
            maxMintableSupply,
            globalWalletLimit,
            mintCurrency,
            fundReceiver,
            royaltyReceiver,
            royaltyFeeNumerator,
            mintFee
        )
    {}


    /*==============================================================
    =                             META                             =
    ==============================================================*/

    /// @notice Returns the contract name and version
    /// @return The contract name and version as strings
    function contractNameAndVersion() public pure override returns (string memory, string memory) {
        return ("ERC1155CM", "1.0.0");
    }

    /// @notice Returns the transfer validator selector used during transaction simulation.
    /// @dev Indicates whether the validation function is view-only.
    /// @return functionSignature Selector for `validateTransfer(address,address,address,uint256,uint256)`
    /// @return isViewFunction False because `validateTransfer` is not a view function
    function getTransferValidationFunction() external pure returns (bytes4 functionSignature, bool isViewFunction) {
        functionSignature = bytes4(keccak256("validateTransfer(address,address,address,uint256,uint256)"));
        isViewFunction = false;
    }

    function _tokenType() internal pure override returns (uint16) {
        return uint16(TOKEN_TYPE_ERC1155);
    }

    /// @notice Checks if the contract supports a given interface
    /// @param interfaceId The interface identifier
    /// @return True if the contract supports the interface, false otherwise
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155M) returns (bool) {
        return interfaceId == type(ICreatorToken).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @notice Overrides behavior of isApprovedForAll such that if an operator is not explicitly approved
    /// @notice for all, the contract owner can optionally auto-approve the transfer validator for transfers.
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool isApproved) {
        isApproved = super.isApprovedForAll(owner, operator);

        if (!isApproved) {
            if (autoApproveTransfersFromValidator) {
                isApproved = operator == address(getTransferValidator());
            }
        }
    }

    /// @dev Overrides the _afterTokenTransfer function to add Creator Token validation
    /// @param operator The address performing the transfer
    /// @param from The address transferring the tokens
    /// @param to The address receiving the tokens
    /// @param ids The IDs of the tokens being transferred
    /// @param amounts The quantities of the tokens being transferred
    /// @param data Additional data with no specified format
    function _afterTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._afterTokenTransfer(operator, from, to, ids, amounts, data);

        // Add Creator Token validation for each token ID
        uint256 idsArrayLength = ids.length;
        for (uint256 i = 0; i < idsArrayLength;) {
            _validateAfterTransfer(from, to, ids[i], amounts[i]);

            unchecked {
                ++i;
            }
        }
    }

    /// @dev Overrides the _beforeTokenTransfer function to add Creator Token validation
    /// @param operator The address performing the transfer
    /// @param from The address transferring the tokens
    /// @param to The address receiving the tokens
    /// @param ids The IDs of the tokens being transferred
    /// @param amounts The quantities of the tokens being transferred
    /// @param data Additional data with no specified format
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        // Call ERC1155M first for transferable check
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        // Then add Creator Token validation for each token ID
        uint256 idsArrayLength = ids.length;
        for (uint256 i = 0; i < idsArrayLength;) {
            _validateBeforeTransfer(from, to, ids[i], amounts[i]);

            unchecked {
                ++i;
            }
        }
    }

    /// @dev Override to prevent double-initialization of the owner
    function _requireCallerIsContractOwner() internal view override {
        _checkOwner();
    }
}
