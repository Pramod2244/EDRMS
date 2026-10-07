package com.edrms.backend.configuration;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/v1/admin/config/application")
public class ApplicationSettingsController {
    private final ApplicationSettingsService service;
    public ApplicationSettingsController(ApplicationSettingsService service){this.service=service;}
    public record Request(String value) {}
    @GetMapping public List<ApplicationSettingsService.Setting> list(){return service.list();}
    @PutMapping("/{key}") public Map<String,String> save(@PathVariable String key,@RequestBody Request request){service.save(key,request.value());return Map.of("message","Setting saved");}
}
