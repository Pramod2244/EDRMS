package com.edrms.backend.documents;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/v1/recycle-bin")
public class RecycleBinController {
    private final RecycleBinService service;
    public RecycleBinController(RecycleBinService service){this.service=service;}
    @GetMapping public org.springframework.data.domain.Page<RecycleBinService.Item> list(@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,@RequestParam(defaultValue="")String term){return service.list(page,size,term);}
    @PostMapping("/{id}/restore") public Map<String,String> restore(@PathVariable UUID id){service.restore(id);return Map.of("message","Document restored to its original folder");}
}
