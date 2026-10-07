package com.edrms.backend.roles;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {
    private final RoleCatalogService service;
    public RoleController(RoleCatalogService service) { this.service=service; }
    @GetMapping public List<Map<String,Object>> list() { return service.list(); }
    @PostMapping public Map<String,Object> create(@RequestBody RoleCatalogService.Request request) { return service.save(null,request); }
    @PutMapping("/{id}") public Map<String,Object> update(@PathVariable UUID id,@RequestBody RoleCatalogService.Request request) { return service.save(id,request); }
}
