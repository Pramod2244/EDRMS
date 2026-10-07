package com.edrms.backend.folders;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class FolderNumberingService {
    public static final long LIMIT=9_000_000_000_000_000L;
    public record Settings(String prefix,String dateMode,int padding,long nextNumber,long revision) {}
    public record View(String prefix,String dateMode,int padding,long nextNumber,long revision,String preview) {}
    private final JdbcTemplate db;
    public FolderNumberingService(JdbcTemplate db) { this.db=db; }
    @Transactional
    public void initialize(UUID id) {
        String prefix="DOC"+id.toString().replace("-","").toUpperCase(Locale.ROOT);
        db.update("INSERT INTO folder_numbering(folder_id,prefix) VALUES (?,?) ON CONFLICT DO NOTHING",id,prefix);
        db.update("INSERT INTO folder_numbering_prefixes(prefix,folder_id) VALUES (?,?) ON CONFLICT DO NOTHING",prefix,id);
    }
    private Settings read(UUID id,boolean lock) {
        return db.query("SELECT n.* FROM folder_numbering n JOIN folders f ON f.id=n.folder_id WHERE n.folder_id=? AND f.is_deleted=false"+(lock ? " FOR UPDATE OF n" : ""),
            (row,index)->new Settings(row.getString("prefix"),row.getString("date_mode"),row.getInt("padding"),row.getLong("next_number"),row.getLong("revision")),id)
            .stream().findFirst().orElseThrow(()->new IllegalArgumentException("Folder unavailable"));
    }
    public static void validate(Settings value) {
        if(value==null || value.prefix()==null || !value.prefix().matches("[A-Z][A-Z0-9]{1,39}")) throw new IllegalArgumentException("Prefix must contain 2–40 uppercase letters or numbers and start with a letter.");
        if(!Set.of("NONE","YEAR","YEAR_MONTH","YEAR_MONTH_DAY").contains(Objects.toString(value.dateMode(),""))) throw new IllegalArgumentException("Select a valid date format.");
        if(value.padding()<1 || value.padding()>10 || value.nextNumber()<1 || value.nextNumber()>LIMIT) throw new IllegalArgumentException("Use 1–10 sequence digits and a next number between 1 and "+LIMIT+".");
    }
    public static String format(Settings value,LocalDate date) {
        String part=switch(value.dateMode()) {
            case "YEAR"->String.format(Locale.ROOT,"-%04d",date.getYear());
            case "YEAR_MONTH"->String.format(Locale.ROOT,"-%04d-%02d",date.getYear(),date.getMonthValue());
            case "YEAR_MONTH_DAY"->"-"+date;
            default->"";
        };
        return value.prefix()+part+"-"+String.format(Locale.ROOT,"%0"+value.padding()+"d",value.nextNumber());
    }
    private View view(Settings value) {
        return new View(value.prefix(),value.dateMode(),value.padding(),value.nextNumber(),value.revision(),format(value,LocalDate.now(ZoneId.of("Asia/Kolkata"))));
    }
    public View get(UUID id) { return view(read(id,false)); }
    @Transactional
    public View save(UUID id,Settings value) {
        validate(value); Settings previous=read(id,true);
        if(value.revision()!=previous.revision()) throw new IllegalArgumentException("This configuration changed. Reload it before saving.");
        if(value.nextNumber()<previous.nextNumber()) throw new IllegalArgumentException("The next number cannot move backwards. Reload to see the latest available number.");
        db.update("INSERT INTO folder_numbering_prefixes(prefix,folder_id) VALUES (?,?) ON CONFLICT DO NOTHING",value.prefix(),id);
        UUID owner=db.queryForObject("SELECT folder_id FROM folder_numbering_prefixes WHERE prefix=?",UUID.class,value.prefix());
        if(!id.equals(owner)) throw new IllegalArgumentException("This prefix belongs to another folder. Choose a unique prefix.");
        db.update("UPDATE folder_numbering SET prefix=?,date_mode=?,padding=?,next_number=?,revision=revision+1 WHERE folder_id=?",value.prefix(),value.dateMode(),value.padding(),value.nextNumber(),id);
        return get(id);
    }
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public String allocate(UUID id) {
        initialize(id);
        Settings value=read(id,true);
        if(value.nextNumber()>=LIMIT) throw new IllegalArgumentException("Folder sequence is exhausted. Contact your administrator.");
        String reference=format(value,LocalDate.now(ZoneId.of("Asia/Kolkata")));
        db.update("UPDATE folder_numbering SET next_number=next_number+1,revision=revision+1 WHERE folder_id=?",id);
        return reference;
    }
}
