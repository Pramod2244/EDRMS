package com.edrms.backend.folders.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateFolderRequest {
    @NotBlank(message = "Folder name is required")
    private String name;
    private UUID parentId;
}
