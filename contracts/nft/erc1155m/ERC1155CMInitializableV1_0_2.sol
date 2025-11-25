//SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import {ERC1155MInitializableV1_0_2} from "./ERC1155MInitializableV1_0_2.sol";
import {CreatorTokenBase} from "@limitbreak/creator-token-standards/src/utils/CreatorTokenBase.sol";
import {AutomaticValidatorTransferApproval} from
    "@limitbreak/creator-token-standards/src/utils/AutomaticValidatorTransferApproval.sol";
import {ICreatorToken} from "@limitbreak/creator-token-standards/src/interfaces/ICreatorToken.sol";
import {TOKEN_TYPE_ERC1155} from "@limitbreak/permit-c/Constants.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

/// @title ERC1155CMInitializableV1_0_2
/// @notice An initializable ERC1155 contract with multi-stage minting, royalties, authorized minters, and Creator Token functionality
/// @dev Extends ERC1155MInitializableV1_0_2 with Creator Token functionality for use with upgradeable proxies

contract ERC1155CMInitializableV1_0_2 is
    ERC1155MInitializableV1_0_2,
    CreatorTokenBase,
    AutomaticValidatorTransferApproval
{
    /*==============================================================
    =                          INITIALIZERS                        =
    ==============================================================*/

    /// @dev Disables initializers for the implementation contract.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract
    /// @param name_ The name of the token collection
    /// @param symbol_ The symbol of the token collection
    /// @param initialOwner The address of the initial owner
    /// @param mintFee The mint fee for the contract
    function initialize(string calldata name_, string calldata symbol_, address initialOwner, uint256 mintFee)
        external
        override
        initializer
    {
        if (initialOwner == address(0)) {
            revert InitialOwnerCannotBeZero();
        }

        name = name_;
        symbol = symbol_;
        __ERC1155_init("");
        _initializeOwner(initialOwner);
        _mintFee = mintFee;

        // Initialize CreatorTokenBase
        _emitDefaultTransferValidator();
        _registerTokenType(getTransferValidator());
    }

    /*==============================================================
    =                             META                             =
    ==============================================================*/

    /// @notice Returns the contract name and version
    /// @return The contract name and version as strings
    function contractNameAndVersion() public pure override returns (string memory, string memory) {
        return ("ERC1155CMInitializable", "1.0.2");
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
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155MInitializableV1_0_2)
        returns (bool)
    {
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
        // Call ERC1155MInitializableV1_0_2 first for transferable check
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

    /// @dev Resolve Context conflict between ContextUpgradeable (from ERC1155Upgradeable) and Context (from CreatorTokenBase)
    /// @dev Use ContextUpgradeable version for upgradeable contracts
    function _msgSender() internal view override(ContextUpgradeable, Context) returns (address) {
        return ContextUpgradeable._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, Context) returns (bytes calldata) {
        return ContextUpgradeable._msgData();
    }
}

