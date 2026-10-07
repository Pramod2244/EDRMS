package com.edrms.backend.configuration;

import com.edrms.backend.roles.RoleCatalogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class ApplicationSettingsService {
    public enum Type { NUMBER, BOOLEAN }
    public record Definition(String key,String label,Type type,String defaultValue,int minimum,int maximum,String description) {}
    public record Setting(String key,String label,Type type,String value,int minimum,int maximum,String description) {}
    private static final Map<String,Definition> DEFINITIONS=Map.of("RECYCLE_BIN_DAYS",new Definition("RECYCLE_BIN_DAYS","Recycle Bin retention (days)",Type.NUMBER,"30",1,3650,"Recovery period for future deletions. Existing recovery deadlines remain unchanged."));
    private final ConfigurationRepository repository;
    private final RoleCatalogService access;
    public ApplicationSettingsService(ConfigurationRepository repository,RoleCatalogService access) {this.repository=repository;this.access=access;}
    public void requireAdmin() {if(!"SUPER_ADMIN".equals(access.requireUser().getRole())) throw new SecurityException("Administrator access is required");}
    public static String validate(Definition definition,String value) {
        if(value==null) throw new IllegalArgumentException("A value is required");
        if(definition.type()==Type.BOOLEAN) {if(!Set.of("true","false").contains(value))throw new IllegalArgumentException("Choose true or false");return value;}
        try {int number=Integer.parseInt(value);if(number<definition.minimum() || number>definition.maximum())throw new NumberFormatException();return Integer.toString(number);}
        catch(NumberFormatException invalid){throw new IllegalArgumentException("Use a whole number between "+definition.minimum()+" and "+definition.maximum());}
    }
    public int retentionDays() {
        String value=repository.findByConfigKey("RECYCLE_BIN_DAYS").map(SystemConfiguration::getConfigValue).orElse("30");
        return Integer.parseInt(validate(DEFINITIONS.get("RECYCLE_BIN_DAYS"),value));
    }
    public List<Setting> list() {
        requireAdmin();return DEFINITIONS.values().stream().map(d->new Setting(d.key(),d.label(),d.type(),repository.findByConfigKey(d.key()).map(SystemConfiguration::getConfigValue).orElse(d.defaultValue()),d.minimum(),d.maximum(),d.description())).toList();
    }
    @Transactional public void save(String key,String value) {
        requireAdmin();Definition definition=DEFINITIONS.get(key);if(definition==null)throw new IllegalArgumentException("Unknown application setting");
        String validated=validate(definition,value);
        var entry=repository.findByConfigKey(key).orElseGet(()->SystemConfiguration.builder().configKey(key).category("APPLICATION").isEncrypted(false).build());
        entry.setConfigValue(validated);entry.setUpdatedBy(access.requireUser().getId());repository.save(entry);
    }
}
